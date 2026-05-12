import { infoClient } from "../utils/hyperliquid.js";

export async function getPrices(req, res) {
    try {
        const mids = await infoClient.allMids();
        res.json(mids);
    } catch (err) {
        console.error("❌ PRICE ERROR:", err);
        res.status(500).json({
            error: "price fetch failed",
        });
    }
}

export async function getMarketContexts(req, res) {
    try {
        const result = await infoClient.metaAndAssetCtxs();

        const universe = result?.[0]?.universe || [];
        const assetCtxs = result?.[1] || [];

        const markets = universe.map((asset, index) => {
            const ctx = assetCtxs[index] || {};

            return {
                coin: asset.name,
                maxLeverage: asset.maxLeverage,
                onlyIsolated: asset.onlyIsolated || false,

                markPx: ctx.markPx,
                oraclePx: ctx.oraclePx,
                midPx: ctx.midPx,
                funding: ctx.funding,
                openInterest: ctx.openInterest,
                dayNtlVlm: ctx.dayNtlVlm,
                prevDayPx: ctx.prevDayPx,
            };
        });

        res.json({
            markets,
        });
    } catch (err) {
        console.error("❌ MARKET CONTEXT ERROR:", err);
        res.status(500).json({
            error: err.message || "failed to fetch market contexts",
        });
    }
}