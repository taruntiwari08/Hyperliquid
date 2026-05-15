import { infoClient } from "../utils/hyperliquid.js";
import { normalizeAddress } from "../utils/validators.js";

const BUILDER_FEE_TENTHS_BP = Number(process.env.BUILDER_FEE_TENTHS_BP || 100);

// Your current estimate constants
const EXCHANGE_FEE_RATE = Number(process.env.EXCHANGE_FEE_RATE || 0.00045);

// Hyperliquid builder fee f is tenths of a basis point.
// 100 tenths bp = 10 bp = 0.1% = 0.001
const BUILDER_FEE_RATE = BUILDER_FEE_TENTHS_BP / 100000;

function parseSlippageSteps(value, fallback) {
    if (!value) return fallback;

    const parsed = value
        .split(",")
        .map((v) => Number(v.trim()))
        .filter((v) => Number.isFinite(v) && v > 0);

    return parsed.length ? parsed : fallback;
}

const OPEN_ORDER_SLIPPAGE_STEPS = parseSlippageSteps(
    process.env.OPEN_ORDER_SLIPPAGE_STEPS,
    [0.0005, 0.001, 0.0015, 0.002, 0.003]
);

function getMaxSlippage() {
    return Math.max(...OPEN_ORDER_SLIPPAGE_STEPS);
}

function getMarketMaps(metaAndCtxs) {
    const universe = metaAndCtxs?.[0]?.universe || [];
    const assetCtxs = metaAndCtxs?.[1] || [];

    const marketMap = {};

    universe.forEach((asset, index) => {
        const ctx = assetCtxs[index] || {};

        marketMap[asset.name] = {
            coin: asset.name,
            maxLeverage: Number(asset.maxLeverage || 0),
            markPx: Number(ctx.markPx || 0),
            oraclePx: Number(ctx.oraclePx || 0),
            midPx: Number(ctx.midPx || 0),
            prevDayPx: Number(ctx.prevDayPx || 0),
            openInterest: Number(ctx.openInterest || 0),
            dayNtlVlm: Number(ctx.dayNtlVlm || 0),
        };
    });

    return marketMap;
}

function getMaintenanceMarginRate(maxLeverage) {
    if (!maxLeverage || maxLeverage <= 0) {
        return 0.0125; // fallback similar to 40x market
    }

    // Approximation from Hyperliquid margining:
    // maintenance margin is half of initial margin at max leverage.
    return 1 / maxLeverage / 2;
}

function getPositionPnl(position, markPrice) {
    const szi = Number(position?.szi || 0);
    const entryPx = Number(position?.entryPx || 0);

    if (!szi || !entryPx || !markPrice) return 0;

    return szi * (markPrice - entryPx);
}

function getSimulatedEntry({
    currentSize,
    currentEntry,
    orderSize,
    orderEntry,
}) {
    const newSize = currentSize + orderSize;

    if (!newSize) {
        return 0;
    }

    // Same direction or no current position
    if (
        currentSize === 0 ||
        Math.sign(currentSize) === Math.sign(orderSize)
    ) {
        return (
            (Math.abs(currentSize) * currentEntry +
                Math.abs(orderSize) * orderEntry) /
            Math.abs(newSize)
        );
    }

    // Reducing existing position, entry stays same
    if (Math.sign(newSize) === Math.sign(currentSize)) {
        return currentEntry;
    }

    // Flipped position, new residual uses new order entry approx
    return orderEntry;
}

function estimateLiquidationPrice({
    state,
    marketMap,
    coin,
    isLong,
    margin,
    leverage,
    entryPrice,
    orderValue,
    estimatedFees,
}) {
    const assetPositions = state?.assetPositions || [];

    const selectedRaw = assetPositions.find(
        (item) => item?.position?.coin === coin
    );

    const selectedPosition = selectedRaw?.position || null;

    const selectedMarket = marketMap[coin] || {};
    const selectedMaxLev = selectedMarket.maxLeverage || 40;
    const selectedMmr = getMaintenanceMarginRate(selectedMaxLev);

    const currentSelectedSize = Number(selectedPosition?.szi || 0);
    const currentSelectedEntry = Number(selectedPosition?.entryPx || entryPrice);

    const signedOrderSize = isLong
        ? orderValue / entryPrice
        : -(orderValue / entryPrice);

    const newSelectedSize = currentSelectedSize + signedOrderSize;

    if (!newSelectedSize) {
        return null;
    }

    const newSelectedEntry = getSimulatedEntry({
        currentSize: currentSelectedSize,
        currentEntry: currentSelectedEntry,
        orderSize: signedOrderSize,
        orderEntry: entryPrice,
    });

    let currentTotalUpnl = 0;
    let otherUpnlConstant = 0;
    let otherMaintenance = 0;

    for (const item of assetPositions) {
        const p = item?.position;
        if (!p) continue;

        const pCoin = p.coin;
        const market = marketMap[pCoin] || {};
        const markPx = Number(market.markPx || market.midPx || market.oraclePx || 0);
        const size = Number(p.szi || 0);
        const positionValue = Math.abs(size) * markPx;
        const maxLev = Number(market.maxLeverage || p.maxLeverage || 40);
        const mmr = getMaintenanceMarginRate(maxLev);

        const pnl = Number(p.unrealizedPnl || getPositionPnl(p, markPx));
        currentTotalUpnl += pnl;

        if (pCoin !== coin) {
            otherUpnlConstant += pnl;
            otherMaintenance += positionValue * mmr;
        }
    }

    const accountValue = Number(state?.marginSummary?.accountValue || 0);

    // Approx collateral = accountValue - current unrealized pnl
    const collateralBefore = accountValue - currentTotalUpnl;
    const collateralAfter = collateralBefore - estimatedFees;

    // Equity at selected price P:
    // collateralAfter + otherUpnl + newSelectedSize * (P - newSelectedEntry)
    //
    // Maintenance:
    // otherMaintenance + abs(newSelectedSize) * P * selectedMmr
    //
    // Solve:
    // collateralAfter + otherUpnl - newSelectedSize * entry - otherMaintenance
    // + P * (newSelectedSize - abs(newSelectedSize) * mmr) = 0

    const constant =
        collateralAfter +
        otherUpnlConstant -
        newSelectedSize * newSelectedEntry -
        otherMaintenance;

    const coefficient =
        newSelectedSize - Math.abs(newSelectedSize) * selectedMmr;

    if (!coefficient) return null;

    const liq = -constant / coefficient;

    if (!Number.isFinite(liq) || liq <= 0) {
        return null;
    }

    // Sanity checks:
    // Long liquidation should be below entry.
    // Short liquidation should be above entry.
    if (newSelectedSize > 0 && liq >= entryPrice) {
        return null;
    }

    if (newSelectedSize < 0 && liq <= entryPrice) {
        return null;
    }

    return liq;
}

export async function getTradePreview(req, res) {
    try {
        const {
            userAddress,
            coin,
            isLong,
            margin,
            leverage,
        } = req.body;

        const address = normalizeAddress(userAddress);

        if (!address) {
            return res.status(400).json({
                error: "Invalid user address",
            });
        }

        if (!coin || typeof coin !== "string") {
            return res.status(400).json({
                error: "Invalid coin",
            });
        }

        if (typeof isLong !== "boolean") {
            return res.status(400).json({
                error: "Invalid side",
            });
        }

        const marginNum = Number(margin);
        const leverageNum = Number(leverage);

        if (!marginNum || marginNum <= 0) {
            return res.status(400).json({
                error: "Invalid margin",
            });
        }

        if (!leverageNum || leverageNum <= 0) {
            return res.status(400).json({
                error: "Invalid leverage",
            });
        }

        const [state, metaAndCtxs, mids] = await Promise.all([
            infoClient.clearinghouseState({ user: address }),
            infoClient.metaAndAssetCtxs(),
            infoClient.allMids(),
        ]);

        const marketMap = getMarketMaps(metaAndCtxs);
        const market = marketMap[coin];

        if (!market) {
            return res.status(400).json({
                error: "Unsupported market",
            });
        }

        const maxLeverage = Number(market.maxLeverage || 0);

        if (maxLeverage && leverageNum > maxLeverage) {
            return res.status(400).json({
                error: `Max leverage for ${coin} is ${maxLeverage}x`,
            });
        }

        const markPrice = Number(market.markPx || 0);
        const oraclePrice = Number(market.oraclePx || 0);
        const midPrice = Number(mids?.[coin] || market.midPx || markPrice || oraclePrice || 0);

        if (!midPrice) {
            return res.status(400).json({
                error: "Market price unavailable",
            });
        }

        const orderValue = marginNum * leverageNum;
        const size = orderValue / midPrice;

        const exchangeFee = orderValue * EXCHANGE_FEE_RATE;
        const builderFee = orderValue * BUILDER_FEE_RATE;
        const estimatedFees = exchangeFee + builderFee;

        const maxSlippage = getMaxSlippage();
        const estimatedSlippage = OPEN_ORDER_SLIPPAGE_STEPS[0];

        const aggressiveLimitPrice = isLong
            ? midPrice * (1 + maxSlippage)
            : midPrice * (1 - maxSlippage);

        const liquidationPrice = estimateLiquidationPrice({
            state,
            marketMap,
            coin,
            isLong,
            margin: marginNum,
            leverage: leverageNum,
            entryPrice: midPrice,
            orderValue,
            estimatedFees,
        });

        res.json({
            address,
            coin,
            side: isLong ? "LONG" : "SHORT",

            markPrice,
            oraclePrice,
            midPrice,

            orderValue,
            marginRequired: marginNum,
            leverage: leverageNum,
            size,

            liquidationPrice,

            slippage: {
                mode: "auto",
                estimated: estimatedSlippage,
                max: maxSlippage,
                estimatedPercent: estimatedSlippage * 100,
                maxPercent: maxSlippage * 100,
                aggressiveLimitPrice,
            },

            fees: {
                exchangeFeeRate: EXCHANGE_FEE_RATE,
                builderFeeRate: BUILDER_FEE_RATE,
                exchangeFee,
                builderFee,
                totalEstimatedFee: estimatedFees,
            },

            account: {
                accountValue: Number(state?.marginSummary?.accountValue || 0),
                withdrawable: Number(state?.withdrawable || 0),
                totalMarginUsed: Number(state?.marginSummary?.totalMarginUsed || 0),
            },

            note: "Liquidation price is a server-side estimate before execution. Actual liquidationPx after trade comes from Hyperliquid position state.",
        });
    } catch (err) {
        console.error("❌ TRADE PREVIEW ERROR:", err);

        res.status(500).json({
            error: err.message || "failed to build trade preview",
        });
    }
}