import {
    formatPrice,
    formatSize,
} from "@nktkas/hyperliquid/utils";

import AgentWallet from "../models/AgentWallet.js";
import { decryptPrivateKey } from "../utils/crypto.js";
import {
    converter,
    infoClient,
    createExchangeClientFromPrivateKey,
} from "../utils/hyperliquid.js";

import {
    normalizeAddress,
    validateTradeInput,
} from "../utils/validators.js";

import { withUserLock } from "../utils/locks.js";

const BUILDER_ADDRESS = process.env.BUILDER_ADDRESS;
const BUILDER_FEE_TENTHS_BP = Number(process.env.BUILDER_FEE_TENTHS_BP || 100);

async function getApprovedAgentForUser(userAddress) {
    const agent = await AgentWallet.findOne({
        userAddress,
    });

    if (!agent) {
        throw new Error("Agent not created for this user");
    }

    if (!agent.isApproved) {
        throw new Error("Agent not approved for this user");
    }

    if (agent.validUntil && Date.now() > agent.validUntil) {
        throw new Error("Agent expired. Create and approve a new agent.");
    }

    const privateKey = decryptPrivateKey(agent.encryptedPrivateKey);

    return {
        agent,
        privateKey,
    };
}

export async function openTrade(req, res) {
    try {
        const {
            userAddress,
            coin,
            isLong,
            margin,
            leverage,
            tpPrice,
            slPrice,
        } = req.body;

        const error = validateTradeInput({
            userAddress,
            coin,
            isLong,
            margin,
            leverage,
        });

        if (error) {
            return res.status(400).json({ error });
        }

        if (!converter) {
            return res.status(500).json({
                error: "System not ready",
            });
        }

        const normalizedUser = normalizeAddress(userAddress);

        const result = await withUserLock(normalizedUser, async () => {
            const { agent, privateKey } =
                await getApprovedAgentForUser(normalizedUser);

            const exchangeClient =
                createExchangeClientFromPrivateKey(privateKey);

            const assetId = converter.getAssetId(coin);
            const szDecimals = converter.getSzDecimals(coin);

            if (assetId === undefined || szDecimals === undefined) {
                throw new Error("Invalid asset");
            }

            await exchangeClient.updateLeverage({
                asset: assetId,
                isCross: true,
                leverage: Number(leverage),
            });

            const mids = await infoClient.allMids();
            const mid = Number(mids[coin]);

            if (!mid || isNaN(mid)) {
                throw new Error("Invalid market price");
            }

            // ===============================
            // ✅ BACKEND TP/SL VALIDATION
            // ===============================
            if (tpPrice && Number(tpPrice) > 0) {
                const tp = Number(tpPrice);

                if (isLong && tp <= mid) {
                    throw new Error("For LONG, take profit must be above market price");
                }

                if (!isLong && tp >= mid) {
                    throw new Error("For SHORT, take profit must be below market price");
                }
            }

            if (slPrice && Number(slPrice) > 0) {
                const sl = Number(slPrice);

                if (isLong && sl >= mid) {
                    throw new Error("For LONG, stop loss must be below market price");
                }

                if (!isLong && sl <= mid) {
                    throw new Error("For SHORT, stop loss must be above market price");
                }
            }

            const userMargin = Number(margin);
            const userLeverage = Number(leverage);

            if (!userMargin || userMargin <= 0) {
                throw new Error("Invalid margin");
            }

            const positionValue = userMargin * userLeverage;

            // ✅ Hyperliquid size is coin amount:
            // coinSize = margin * leverage / price
            const rawCoinSize = positionValue / mid;

            const tolerance = 0.01;

            // ✅ IOC aggressive limit order, behaves like market order
            const entryPrice = mid * (isLong ? 1 + tolerance : 1 - tolerance);

            const formattedEntryPrice = formatPrice(entryPrice, szDecimals);
            const formattedSize = formatSize(String(rawCoinSize), szDecimals);

            if (!formattedSize || Number(formattedSize) <= 0) {
                throw new Error("Invalid order size after formatting");
            }

            const orders = [
                {
                    a: assetId,
                    b: isLong,
                    p: formattedEntryPrice,
                    s: formattedSize,
                    r: false,
                    t: { limit: { tif: "Ioc" } },
                },
            ];

            // ✅ Trigger close order side is opposite of entry.
            // LONG close = sell below market.
            // SHORT close = buy above market.
            const closeLimitPrice = mid * (isLong ? 0.99 : 1.01);
            const formattedCloseLimitPrice = formatPrice(
                closeLimitPrice,
                szDecimals
            );

            // ===============================
            // ✅ OPTIONAL TAKE PROFIT
            // ===============================
            if (tpPrice && Number(tpPrice) > 0) {
                const tp = Number(tpPrice);

                orders.push({
                    a: assetId,
                    b: !isLong,
                    p: formattedCloseLimitPrice,
                    s: formattedSize,
                    r: true,
                    t: {
                        trigger: {
                            isMarket: true,
                            triggerPx: formatPrice(tp, szDecimals),
                            tpsl: "tp",
                        },
                    },
                });
            }

            // ===============================
            // ✅ OPTIONAL STOP LOSS
            // ===============================
            if (slPrice && Number(slPrice) > 0) {
                const sl = Number(slPrice);

                orders.push({
                    a: assetId,
                    b: !isLong,
                    p: formattedCloseLimitPrice,
                    s: formattedSize,
                    r: true,
                    t: {
                        trigger: {
                            isMarket: true,
                            triggerPx: formatPrice(sl, szDecimals),
                            tpsl: "sl",
                        },
                    },
                });
            }

            const grouping = orders.length > 1 ? "normalTpsl" : "na";

            const orderPayload = {
                orders,
                grouping,

                builder: {
                    b: BUILDER_ADDRESS,
                    f: BUILDER_FEE_TENTHS_BP,
                },
            };

            console.log("📊 Order payload:", {
                userAddress: normalizedUser,
                coin,
                side: isLong ? "LONG" : "SHORT",
                margin: userMargin,
                leverage: userLeverage,
                positionValue,
                mid,
                rawCoinSize,
                formattedSize,
                formattedEntryPrice,
                closeLimitPrice: formattedCloseLimitPrice,
                tpPrice: tpPrice || null,
                slPrice: slPrice || null,
                grouping,
                builder: BUILDER_ADDRESS,
                builderFeeTenthsBp: BUILDER_FEE_TENTHS_BP,
            });

            const orderResult = await exchangeClient.order(orderPayload);

            agent.lastUsedAt = new Date();
            await agent.save();

            return {
                orderResult,
                meta: {
                    userAddress: normalizedUser,
                    agentAddress: agent.agentAddress,
                    coin,
                    side: isLong ? "LONG" : "SHORT",
                    margin: userMargin,
                    size: formattedSize,
                    price: formattedEntryPrice,
                    notionalUsd: Number(formattedSize) * mid,
                    leverage: userLeverage,
                    tpPrice: tpPrice || null,
                    slPrice: slPrice || null,
                    grouping,
                    builder: BUILDER_ADDRESS,
                    builderFeeTenthsBp: BUILDER_FEE_TENTHS_BP,
                },
            };
        });

        res.json({
            success: true,
            result: result.orderResult,
            meta: result.meta,
        });
    } catch (err) {
        console.error("❌ TRADE ERROR:", err);

        if (err?.message?.includes("Agent not created")) {
            return res.status(400).json({
                error: "Agent not created. Create and approve agent first.",
            });
        }

        if (err?.message?.includes("Agent not approved")) {
            return res.status(400).json({
                error: "Agent not approved. Approve agent first.",
            });
        }

        if (err?.message?.includes("Agent expired")) {
            return res.status(400).json({
                error: err.message,
            });
        }

        if (err?.message?.includes("Builder fee has not been approved")) {
            return res.status(400).json({
                error: "Builder fee has not been approved.",
            });
        }

        if (err?.message?.includes("does not exist")) {
            return res.status(400).json({
                error: "User not onboarded. Deposit funds first.",
            });
        }

        if (
            err?.message?.includes("take profit") ||
            err?.message?.includes("stop loss")
        ) {
            return res.status(400).json({
                error: err.message,
            });
        }

        res.status(500).json({
            error: err.message || "trade failed",
        });
    }
}

export async function closePosition(req, res) {
    try {
        const { coin, address } = req.body;

        const normalizedUser = normalizeAddress(address);

        if (!coin) {
            return res.status(400).json({
                error: "coin required",
            });
        }

        if (!normalizedUser) {
            return res.status(400).json({
                error: "valid user address required",
            });
        }

        if (!converter) {
            return res.status(500).json({
                error: "system not ready",
            });
        }

        const result = await withUserLock(normalizedUser, async () => {
            const { agent, privateKey } =
                await getApprovedAgentForUser(normalizedUser);

            const exchangeClient =
                createExchangeClientFromPrivateKey(privateKey);

            const assetId = converter.getAssetId(coin);
            const szDecimals = converter.getSzDecimals(coin);

            if (assetId === undefined || szDecimals === undefined) {
                throw new Error("invalid asset");
            }

            const state = await infoClient.clearinghouseState({
                user: normalizedUser,
            });

            const position = state.assetPositions.find(
                (p) => p.position.coin === coin
            );

            if (!position || Number(position.position.szi) === 0) {
                return {
                    noPosition: true,
                };
            }

            const rawSize = Number(position.position.szi);
            const closeSize = Math.abs(rawSize);
            const isLong = rawSize > 0;

            const mids = await infoClient.allMids();
            const mid = Number(mids[coin]);

            if (!mid || isNaN(mid)) {
                throw new Error("invalid market price");
            }

            const tolerance = 0.01;
            const price = mid * (isLong ? 1 - tolerance : 1 + tolerance);

            const formattedPrice = formatPrice(price, szDecimals);
            const formattedSize = formatSize(String(closeSize), szDecimals);

            const closeResult = await exchangeClient.order({
                orders: [
                    {
                        a: assetId,
                        b: !isLong,
                        p: formattedPrice,
                        s: formattedSize,
                        r: true,
                        t: { limit: { tif: "Ioc" } },
                    },
                ],
                grouping: "na",

                builder: {
                    b: BUILDER_ADDRESS,
                    f: BUILDER_FEE_TENTHS_BP,
                },
            });

            agent.lastUsedAt = new Date();
            await agent.save();

            return {
                noPosition: false,
                closeResult,
                coin,
                sideClosed: isLong ? "LONG" : "SHORT",
                size: formattedSize,
                price: formattedPrice,
            };
        });

        if (result.noPosition) {
            return res.json({
                success: false,
                message: "No open position",
            });
        }

        res.json({
            success: true,
            closed: true,
            coin: result.coin,
            sideClosed: result.sideClosed,
            size: result.size,
            price: result.price,
            result: result.closeResult,
        });
    } catch (err) {
        console.error("❌ CLOSE ERROR:", err);

        if (err?.message?.includes("Agent not created")) {
            return res.status(400).json({
                error: "Agent not created. Create and approve agent first.",
            });
        }

        if (err?.message?.includes("Agent not approved")) {
            return res.status(400).json({
                error: "Agent not approved. Approve agent first.",
            });
        }

        res.status(500).json({
            error: err.message || "close failed",
        });
    }
}