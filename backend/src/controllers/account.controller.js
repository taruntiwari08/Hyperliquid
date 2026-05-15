import { infoClient } from "../utils/hyperliquid.js";
import { normalizeAddress } from "../utils/validators.js";
import { decryptPrivateKey } from "../utils/crypto.js";
import { createExchangeClientFromPrivateKey } from "../utils/hyperliquid.js";
import AgentWallet from "../models/AgentWallet.js";


const HL_INFO_URL =
    process.env.HL_IS_TESTNET === "true"
        ? "https://api.hyperliquid-testnet.xyz/info"
        : "https://api.hyperliquid.xyz/info";

async function hyperliquidInfo(body) {
    const res = await fetch(HL_INFO_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

    const text = await res.text();

    if (!res.ok) {
        throw new Error(text || "Hyperliquid info request failed");
    }

    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

export async function getOpenOrders(req, res) {
    try {
        const address = normalizeAddress(req.params.address);

        if (!address) {
            return res.status(400).json({
                error: "Invalid address",
            });
        }

        const orders = await hyperliquidInfo({
            type: "frontendOpenOrders",
            user: address,
        });

        res.json({
            address,
            orders: Array.isArray(orders) ? orders : [],
        });
    } catch (err) {
        console.error("❌ OPEN ORDERS ERROR:", err);

        res.status(500).json({
            error: err.message || "failed to fetch open orders",
        });
    }
}

export async function getBalance(req, res) {
    try {
        const address = normalizeAddress(req.params.address);

        if (!address) {
            return res.status(400).json({
                error: "Invalid address",
            });
        }

        const state = await infoClient.clearinghouseState({
            user: address,
        });

        res.json({
            address,
            balance: state?.marginSummary?.accountValue || "0",
            accountValue: state?.marginSummary?.accountValue || "0",
            withdrawable: state?.withdrawable || "0",
            totalRawUsd: state?.marginSummary?.totalRawUsd || "0",
            totalMarginUsed: state?.marginSummary?.totalMarginUsed || "0",
        });
    } catch (err) {
        console.error("❌ BALANCE ERROR:", err);

        if (err?.message?.includes("does not exist")) {
            return res.json({
                address: req.params.address,
                balance: "0",
                accountValue: "0",
                withdrawable: "0",
                totalRawUsd: "0",
                totalMarginUsed: "0",
            });
        }

        res.status(500).json({
            error: err.message,
        });
    }
}

export async function getDebugState(req, res) {
    try {
        const address = normalizeAddress(req.params.address);

        if (!address) {
            return res.status(400).json({
                error: "Invalid address",
            });
        }

        const state = await infoClient.clearinghouseState({
            user: address,
        });

        res.json(state);
    } catch (err) {
        res.status(500).json({
            error: err.message,
        });
    }
}

export async function getPositions(req, res) {
    try {
        const address = normalizeAddress(req.params.address);

        if (!address) {
            return res.status(400).json({
                error: "Invalid address",
            });
        }

        const state = await infoClient.clearinghouseState({
            user: address,
        });

        const metaAndCtxs = await infoClient.metaAndAssetCtxs();

        const universe = metaAndCtxs?.[0]?.universe || [];
        const assetCtxs = metaAndCtxs?.[1] || [];

        const marketMap = {};

        universe.forEach((asset, index) => {
            const ctx = assetCtxs[index] || {};

            marketMap[asset.name] = {
                coin: asset.name,
                maxLeverage: asset.maxLeverage,
                markPx: ctx.markPx,
                oraclePx: ctx.oraclePx,
                midPx: ctx.midPx,
                funding: ctx.funding,
                openInterest: ctx.openInterest,
                dayNtlVlm: ctx.dayNtlVlm,
                prevDayPx: ctx.prevDayPx,
            };
        });

        const positions = (state?.assetPositions || [])
            .filter((item) => Number(item?.position?.szi || 0) !== 0)
            .map((item) => {
                const p = item.position || {};

                const coin = p.coin;
                const market = marketMap[coin] || {};

                const rawSize = Number(p.szi || 0);
                const absSize = Math.abs(rawSize);

                const entryPrice = Number(p.entryPx || 0);

                const markPrice = Number(
                    market.markPx ||
                    market.midPx ||
                    market.oraclePx ||
                    0
                );

                const positionValue =
                    Number(p.positionValue || 0) ||
                    absSize * markPrice;

                const leverage =
                    Number(p.leverage?.value || 0) ||
                    (Number(p.marginUsed || 0) > 0
                        ? positionValue / Number(p.marginUsed || 1)
                        : 0);

                const liquidationPx =
                    p.liquidationPx ??
                    p.liqPx ??
                    p.liquidationPrice ??
                    null;

                return {
                    coin,

                    side: rawSize > 0 ? "LONG" : "SHORT",
                    isLong: rawSize > 0,

                    size: rawSize,
                    absSize,

                    entryPrice,
                    markPrice,
                    oraclePrice: Number(market.oraclePx || 0),
                    midPrice: Number(market.midPx || 0),

                    pnl: Number(p.unrealizedPnl || 0),
                    pnlPercent: Number(p.returnOnEquity || 0) * 100,

                    liquidationPrice:
                        liquidationPx !== null && liquidationPx !== undefined
                            ? Number(liquidationPx)
                            : null,

                    marginUsed: Number(p.marginUsed || 0),
                    positionValue,
                    leverage,
                    maxLeverage: Number(market.maxLeverage || 0),

                    raw: item,
                };
            });

        res.json({
            address,
            accountValue: state?.marginSummary?.accountValue || "0",
            withdrawable: state?.withdrawable || "0",
            totalMarginUsed: state?.marginSummary?.totalMarginUsed || "0",
            positions,
        });
    } catch (err) {
        console.error("❌ POSITIONS ERROR:", err);

        res.status(500).json({
            error: err.message || "failed to fetch positions",
        });
    }
}

export async function getBuilderStats(req, res) {
    try {
        const address = normalizeAddress(req.params.address);

        if (!address) {
            return res.status(400).json({
                error: "Invalid address",
            });
        }

        const result = await infoClient.referral({
            user: address,
        });

        res.json(result);
    } catch (err) {
        console.error("❌ BUILDER STATS ERROR:", err);

        res.status(500).json({
            error: err.message || "failed to fetch builder stats",
        });
    }
}