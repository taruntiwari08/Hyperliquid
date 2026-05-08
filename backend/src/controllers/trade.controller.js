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

const TPSL_CLOSE_TOLERANCE = Number(process.env.TPSL_CLOSE_TOLERANCE || 0.001);

function parseSlippageSteps(value, fallback) {
    if (!value) return fallback;

    const parsed = value
        .split(",")
        .map((v) => Number(v.trim()))
        .filter((v) => !Number.isNaN(v) && v > 0);

    return parsed.length ? parsed : fallback;
}

const OPEN_ORDER_SLIPPAGE_STEPS = parseSlippageSteps(
    process.env.OPEN_ORDER_SLIPPAGE_STEPS,
    [0.0005, 0.0008, 0.001, 0.0012, 0.0014, 0.0016, 0.0018, 0.002]
);

const CLOSE_ORDER_SLIPPAGE_STEPS = parseSlippageSteps(
    process.env.CLOSE_ORDER_SLIPPAGE_STEPS,
    [0.0005, 0.0008, 0.001, 0.0012, 0.0014, 0.0016, 0.0018, 0.002]
);

function extractErrorMessages(errOrResult) {
    const messages = [];

    const push = (value) => {
        if (!value) return;
        if (typeof value === "string") messages.push(value);
    };

    push(errOrResult?.message);
    push(errOrResult?.error);

    const statuses =
        errOrResult?.response?.response?.data?.statuses ||
        errOrResult?.response?.data?.statuses ||
        errOrResult?.response?.data ||
        errOrResult?.response?.response?.data ||
        [];

    if (Array.isArray(statuses)) {
        for (const status of statuses) {
            if (typeof status === "string") {
                messages.push(status);
            }

            if (status?.error) {
                messages.push(status.error);
            }

            if (status?.resting?.error) {
                messages.push(status.resting.error);
            }

            if (status?.filled?.error) {
                messages.push(status.filled.error);
            }
        }
    }

    return messages;
}

function isOracleRejectedError(errOrMessage) {
    const messages = extractErrorMessages(errOrMessage);

    const raw = String(
        errOrMessage?.message ||
        errOrMessage?.error ||
        errOrMessage ||
        ""
    );

    messages.push(raw);

    return messages.some((msg) => {
        const lower = String(msg).toLowerCase();

        return (
            lower.includes("price too far from oracle") ||
            lower.includes("oraclerejected") ||
            lower.includes("oracle rejected")
        );
    });
}

function isIocNoMatchError(errOrMessage) {
    const messages = extractErrorMessages(errOrMessage);

    const raw = String(
        errOrMessage?.message ||
        errOrMessage?.error ||
        errOrMessage ||
        ""
    );

    messages.push(raw);

    return messages.some((msg) => {
        const lower = String(msg).toLowerCase();

        return (
            lower.includes("could not immediately match") ||
            lower.includes("ioc") ||
            lower.includes("immediate")
        );
    });
}

function getOrderStatusErrors(result) {
    const statuses = result?.response?.data?.statuses || [];

    return statuses
        .map((status) => {
            if (typeof status === "string") return status;
            if (status?.error) return status.error;
            if (status?.resting?.error) return status.resting.error;
            if (status?.filled?.error) return status.filled.error;
            return null;
        })
        .filter(Boolean);
}

function assertNoRetryableOrderStatus(result) {
    const errors = getOrderStatusErrors(result);

    if (!errors.length) return;

    const msg = errors.join(" | ");

    if (isOracleRejectedError(msg) || isIocNoMatchError(msg)) {
        throw new Error(msg);
    }
}

function getFilledSizeFromOrderResult(result) {
    const statuses = result?.response?.data?.statuses || [];

    let filledSize = 0;

    for (const status of statuses) {
        if (status?.filled?.totalSz) {
            filledSize += Number(status.filled.totalSz);
        }
    }

    return filledSize;
}

async function sendIocOrderWithRetry({
    exchangeClient,
    buildPayload,
    slippageSteps,
    contextLabel,
}) {
    let lastErr = null;

    for (const slippage of slippageSteps) {
        try {
            const payload = buildPayload(slippage);

            console.log(`📤 ${contextLabel} attempt with slippage:`, slippage);

            const result = await exchangeClient.order(payload);

            assertNoRetryableOrderStatus(result);

            return {
                result,
                usedSlippage: slippage,
                payload,
            };
        } catch (err) {
            lastErr = err;

            if (isOracleRejectedError(err)) {
                console.warn(
                    `⚠️ ${contextLabel} oracle rejected at slippage ${slippage}, trying next step...`
                );
                continue;
            }

            if (isIocNoMatchError(err)) {
                console.warn(
                    `⚠️ ${contextLabel} IOC did not match at slippage ${slippage}, trying more aggressive step...`
                );
                continue;
            }

            throw err;
        }
    }

    throw lastErr || new Error(`${contextLabel} failed after all slippage retries`);
}

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
            return res.status(500).json({ error: "System not ready" });
        }

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

            if (!mid || Number.isNaN(mid)) {
                throw new Error("Invalid market price");
            }

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

            const userMargin = Number(margin);
            const userLeverage = Number(leverage);

            if (!userMargin || userMargin <= 0) {
                throw new Error("Invalid margin");
            }

            const positionValue = userMargin * userLeverage;
            const rawCoinSize = positionValue / mid;
            const formattedSize = formatSize(String(rawCoinSize), szDecimals);

            if (!formattedSize || Number(formattedSize) <= 0) {
                throw new Error("Invalid order size after formatting");
            }

            const grouping = hasTp || hasSl ? "normalTpsl" : "na";

            const getTriggerOrder = ({ triggerPrice, isLong, type }) => {
                const trigger = Number(triggerPrice);

                const limitPrice = isLong
                    ? trigger * (1 - TPSL_CLOSE_TOLERANCE)
                    : trigger * (1 + TPSL_CLOSE_TOLERANCE);

                return {
                    triggerPx: formatPrice(trigger, szDecimals),
                    limitPx: formatPrice(limitPrice, szDecimals),
                    tpsl: type,
                };
            };

            const buildOrderPayload = (slippage) => {
                const entryPrice = mid * (isLong ? 1 + slippage : 1 - slippage);
                const formattedEntryPrice = formatPrice(entryPrice, szDecimals);

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

                if (hasTp) {
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

                if (hasSl) {
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

                return {
                    orders,
                    grouping,
                    builder: {
                        b: BUILDER_ADDRESS,
                        f: BUILDER_FEE_TENTHS_BP,
                    },
                };
            };

            const {
                result: orderResult,
                usedSlippage,
                payload: finalPayload,
            } = await sendIocOrderWithRetry({
                exchangeClient,
                buildPayload: buildOrderPayload,
                slippageSteps: OPEN_ORDER_SLIPPAGE_STEPS,
                contextLabel: "OPEN_TRADE",
            });

            const finalEntryOrder = finalPayload.orders[0];

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
                formattedEntryPrice: finalEntryOrder.p,
                hasTp,
                hasSl,
                tpPrice: hasTp ? tpPrice : null,
                slPrice: hasSl ? slPrice : null,
                grouping,
                usedSlippage,
                builder: BUILDER_ADDRESS,
                builderFeeTenthsBp: BUILDER_FEE_TENTHS_BP,
            });

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
                    price: finalEntryOrder.p,
                    notionalUsd: Number(formattedSize) * mid,
                    leverage: userLeverage,
                    tpPrice: hasTp ? tpPrice : null,
                    slPrice: hasSl ? slPrice : null,
                    grouping,
                    usedSlippage,
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

        if (isOracleRejectedError(err)) {
            return res.status(400).json({
                error: "Order price was too far from oracle. Please try again.",
            });
        }

        if (isIocNoMatchError(err)) {
            return res.status(400).json({
                error: "Order could not immediately match. Please try again.",
            });
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
            const position = state.assetPositions.find((p) => p.position.coin === coin);

            if (!position || Number(position.position.szi) === 0) {
                return { noPosition: true };
            }

            const rawSize = Number(position.position.szi);
            const closeSize = Math.abs(rawSize);
            const isLong = rawSize > 0;

            const mids = await infoClient.allMids();
            const mid = Number(mids[coin]);

            if (!mid || Number.isNaN(mid)) {
                throw new Error("invalid market price");
            }

            const formattedSize = formatSize(String(closeSize), szDecimals);

            if (!formattedSize || Number(formattedSize) <= 0) {
                throw new Error("invalid close size after formatting");
            }

            const buildClosePayload = (slippage) => {
                const price = mid * (isLong ? 1 - slippage : 1 + slippage);
                const formattedPrice = formatPrice(price, szDecimals);

                return {
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
                };
            };

            const {
                result: closeResult,
                usedSlippage,
                payload: finalPayload,
            } = await sendIocOrderWithRetry({
                exchangeClient,
                buildPayload: buildClosePayload,
                slippageSteps: CLOSE_ORDER_SLIPPAGE_STEPS,
                contextLabel: "CLOSE_POSITION",
            });

            const filledSize = getFilledSizeFromOrderResult(closeResult);
            const finalCloseOrder = finalPayload.orders[0];

            agent.lastUsedAt = new Date();
            await agent.save();

            return {
                noPosition: false,
                closeResult,
                filledSize,
                coin,
                sideClosed: isLong ? "LONG" : "SHORT",
                size: formattedSize,
                price: finalCloseOrder.p,
                usedSlippage,
            };
        });

        if (result.noPosition) {
            return res.json({ success: false, message: "No open position" });
        }

        res.json({
            success: true,
            closed: result.filledSize > 0,
            coin: result.coin,
            sideClosed: result.sideClosed,
            size: result.size,
            price: result.price,
            filledSize: result.filledSize,
            usedSlippage: result.usedSlippage,
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

        if (isOracleRejectedError(err)) {
            return res.status(400).json({
                error: "Close price was too far from oracle. Please try again.",
            });
        }

        if (isIocNoMatchError(err)) {
            return res.status(400).json({
                error: "Close order could not immediately match. Please try again.",
            });
        }

        res.status(500).json({ error: msg || "close failed" });
    }
}