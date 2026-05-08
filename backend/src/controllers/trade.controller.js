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
    const agent = await AgentWallet.findOne({ userAddress });

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
    return { agent, privateKey };
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

        const error = validateTradeInput({ userAddress, coin, isLong, margin, leverage });
        if (error) return res.status(400).json({ error });

        if (!converter) return res.status(500).json({ error: "System not ready" });

        const normalizedUser = normalizeAddress(userAddress);

        const result = await withUserLock(normalizedUser, async () => {
            const { agent, privateKey } = await getApprovedAgentForUser(normalizedUser);
            const exchangeClient = createExchangeClientFromPrivateKey(privateKey);

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

            if (!mid || isNaN(mid)) throw new Error("Invalid market price");

            // ── TP/SL validation against live mid ────────────────────────
            const hasTp = tpPrice != null && Number(tpPrice) > 0;
            const hasSl = slPrice != null && Number(slPrice) > 0;

            if (hasTp) {
                const tp = Number(tpPrice);
                if (isLong && tp <= mid) {
                    throw new Error("For LONG, take profit must be above market price");
                }
                if (!isLong && tp >= mid) {
                    throw new Error("For SHORT, take profit must be below market price");
                }
            }

            if (hasSl) {
                const sl = Number(slPrice);
                if (isLong && sl >= mid) {
                    throw new Error("For LONG, stop loss must be below market price");
                }
                if (!isLong && sl <= mid) {
                    throw new Error("For SHORT, stop loss must be above market price");
                }
            }

            // ── Position sizing ───────────────────────────────────────────
            const userMargin = Number(margin);
            const userLeverage = Number(leverage);
            if (!userMargin || userMargin <= 0) throw new Error("Invalid margin");

            const positionValue = userMargin * userLeverage;
            const rawCoinSize = positionValue / mid;

            const tolerance = 0.01;
            const entryPrice = mid * (isLong ? 1 + tolerance : 1 - tolerance);

            const formattedEntryPrice = formatPrice(entryPrice, szDecimals);
            const formattedSize = formatSize(String(rawCoinSize), szDecimals);

            if (!formattedSize || Number(formattedSize) <= 0) {
                throw new Error("Invalid order size after formatting");
            }

            // ── Entry order (IOC — behaves like market) ───────────────────
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


            const grouping = (hasTp && hasSl) ? "normalTpsl" : "na";
            const CLOSE_TOLERANCE = 0.001;

            // Helper to calculate trigger and limit prices for TP/SL orders
                const getTriggerOrder = ({
                    triggerPrice,
                    isLong,
                    type, // "tp" | "sl"
                }) => {

                    const trigger = Number(triggerPrice);

                    // Closing LONG = SELL
                    // Closing SHORT = BUY
                    const limitPrice = isLong
                        ? trigger * (1 - CLOSE_TOLERANCE)
                        : trigger * (1 + CLOSE_TOLERANCE);

                    return {
                        triggerPx: formatPrice(trigger, szDecimals),
                        limitPx: formatPrice(limitPrice, szDecimals),
                        tpsl: type,
                    };
                };

           if (tpPrice && Number(tpPrice) > 0) {

                const tpOrder = getTriggerOrder({
                    triggerPrice: tpPrice,
                    isLong,
                    type: "tp",
                });

                orders.push({
                    a: assetId,
                    b: !isLong,
                    p: tpOrder.limitPx,
                    s: formattedSize,
                    r: true,
                    t: {
                        trigger: {
                            isMarket: true,
                            triggerPx: tpOrder.triggerPx,
                            tpsl: tpOrder.tpsl,
                        },
                    },
                });
            }

            if (slPrice && Number(slPrice) > 0) {

                const slOrder = getTriggerOrder({
                    triggerPrice: slPrice,
                    isLong,
                    type: "sl",
                });

                orders.push({
                    a: assetId,
                    b: !isLong,
                    p: slOrder.limitPx,
                    s: formattedSize,
                    r: true,
                    t: {
                        trigger: {
                            isMarket: true,
                            triggerPx: slOrder.triggerPx,
                            tpsl: slOrder.tpsl,
                        },
                    },
                });
}

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
                hasTp,
                hasSl,
                tpPrice: hasTp ? tpPrice : null,
                slPrice: hasSl ? slPrice : null,
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
                    tpPrice: hasTp ? tpPrice : null,
                    slPrice: hasSl ? slPrice : null,
                    grouping,
                    builder: BUILDER_ADDRESS,
                    builderFeeTenthsBp: BUILDER_FEE_TENTHS_BP,
                },
            };
        });

        res.json({ success: true, result: result.orderResult, meta: result.meta });
    } catch (err) {
        console.error("❌ TRADE ERROR:", err);

        const msg = err?.message || "";

        if (msg.includes("Agent not created")) {
            return res.status(400).json({ error: "Agent not created. Create and approve agent first." });
        }
        if (msg.includes("Agent not approved")) {
            return res.status(400).json({ error: "Agent not approved. Approve agent first." });
        }
        if (msg.includes("Agent expired")) {
            return res.status(400).json({ error: msg });
        }
        if (msg.includes("Builder fee has not been approved")) {
            return res.status(400).json({ error: "Builder fee has not been approved." });
        }
        if (msg.includes("does not exist")) {
            return res.status(400).json({ error: "User not onboarded. Deposit funds first." });
        }
        if (msg.includes("take profit") || msg.includes("stop loss")) {
            return res.status(400).json({ error: msg });
        }

        res.status(500).json({ error: msg || "trade failed" });
    }
}

export async function closePosition(req, res) {
    try {
        const { coin, address } = req.body;

        const normalizedUser = normalizeAddress(address);

        if (!coin) return res.status(400).json({ error: "coin required" });
        if (!normalizedUser) return res.status(400).json({ error: "valid user address required" });
        if (!converter) return res.status(500).json({ error: "system not ready" });

        const result = await withUserLock(normalizedUser, async () => {
            const { agent, privateKey } = await getApprovedAgentForUser(normalizedUser);
            const exchangeClient = createExchangeClientFromPrivateKey(privateKey);

            const assetId = converter.getAssetId(coin);
            const szDecimals = converter.getSzDecimals(coin);

            if (assetId === undefined || szDecimals === undefined) {
                throw new Error("invalid asset");
            }

            const state = await infoClient.clearinghouseState({ user: normalizedUser });
            const position = state.assetPositions.find(p => p.position.coin === coin);

            if (!position || Number(position.position.szi) === 0) {
                return { noPosition: true };
            }

            const rawSize = Number(position.position.szi);
            const closeSize = Math.abs(rawSize);
            const isLong = rawSize > 0;

            const mids = await infoClient.allMids();
            const mid = Number(mids[coin]);

            if (!mid || isNaN(mid)) throw new Error("invalid market price");

            const tolerance = 0.003; // 0.3% price tolerance for closing
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

            return { noPosition: false, closeResult, coin, sideClosed: isLong ? "LONG" : "SHORT", size: formattedSize, price: formattedPrice };
        });

        if (result.noPosition) {
            return res.json({ success: false, message: "No open position" });
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

        const msg = err?.message || "";

        if (msg.includes("Agent not created")) {
            return res.status(400).json({ error: "Agent not created. Create and approve agent first." });
        }
        if (msg.includes("Agent not approved")) {
            return res.status(400).json({ error: "Agent not approved. Approve agent first." });
        }

        res.status(500).json({ error: msg || "close failed" });
    }
}