import { normalizeAddress } from "../utils/validators.js";

const HL_INFO_URL =
    process.env.HL_IS_TESTNET === "true"
        ? "https://api.hyperliquid-testnet.xyz/info"
        : "https://api.hyperliquid.xyz/info";

async function hlPost(body) {
    const res = await fetch(HL_INFO_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(text || "Hyperliquid request failed");
    try { return JSON.parse(text); } catch { return text; }
}

function aggregateFills(fills) {

    if (!fills.length) return [];

    const grouped = [];

    // milliseconds window
    const GROUP_WINDOW = 2000;

    for (const fill of fills) {

        const last = grouped[grouped.length - 1];

        const canMerge =
            last &&
            last.coin === fill.coin &&
            last.dir === fill.dir &&
            last.side === fill.side &&
            Math.abs(last.time - fill.time) <= GROUP_WINDOW;

        if (canMerge) {

            const totalSize =
                Number(last.size) + Number(fill.size);

            const totalValue =
                Number(last.value) + Number(fill.value);

            const weightedPrice =
                totalValue / totalSize;

            last.size = totalSize;
            last.value = totalValue;
            last.price = weightedPrice;

            last.closedPnl =
                Number(last.closedPnl) +
                Number(fill.closedPnl || 0);

            last.fee =
                Number(last.fee) +
                Number(fill.fee || 0);

            // newest fill time
            last.time = Math.max(last.time, fill.time);

        } else {

            grouped.push({
                ...fill,
                size: Number(fill.size),
                value: Number(fill.value),
                price: Number(fill.price),
                closedPnl: Number(fill.closedPnl || 0),
                fee: Number(fill.fee || 0),
            });
        }
    }

    return grouped;
}

// ────────────────────────────────────────────
// GET TRADE HISTORY  (userFillsByTime)
// Params: address, startTime?, endTime?, limit?
// ────────────────────────────────────────────
export async function getTradeHistory(req, res) {
    try {
        const address = normalizeAddress(req.params.address);
        if (!address) return res.status(400).json({ error: "Invalid address" });

        // Default: last 30 days
        const endTime   = Number(req.query.endTime)   || Date.now();
        const startTime = Number(req.query.startTime) || endTime - 30 * 24 * 60 * 60 * 1000;

        // const fills = await hlPost({
        //     type: "userFillsByTime",
        //     user: startTime,      // note: API positional — user param is address
        //     startTime,
        //     endTime,
        // });

        // Re-fetch correctly — API expects { type, user, startTime, endTime }
        const fillsCorrect = await hlPost({
            type: "userFillsByTime",
            user: address,
            startTime,
            endTime,
        });

        const normalized = (Array.isArray(fillsCorrect) ? fillsCorrect : []).map(f => ({
            id:         f.tid || f.oid,
            coin:       f.coin,
            side:       f.side === "B" ? "Buy" : "Sell",
            dir:        f.dir || "",           // "Open Long", "Close Short", etc.
            price:      f.px,
            size:       f.sz,
            value:      Number(f.px) * Number(f.sz),
            closedPnl:  f.closedPnl || "0",
            fee:        f.fee || "0",
            feeToken:   f.feeToken || "USDC",
            builderFee: f.builderFee || "0",
            startPos:   f.startPosition || "0",
            crossed:    f.crossed,
            hash:       f.hash,
            time:       f.time,
        }));

        // Sort newest first
       normalized.sort((a, b) => a.time - b.time);

        const aggregated = aggregateFills(normalized);

        // newest first
        aggregated.sort((a, b) => b.time - a.time);

        res.json({
            address,
            fills: aggregated,
            count: aggregated.length,
        });
    } catch (err) {
        console.error("❌ TRADE HISTORY ERROR:", err);
        res.status(500).json({ error: err.message || "Failed to fetch trade history" });
    }
}

// ────────────────────────────────────────────
// GET TRANSFER HISTORY  (userNonFundingLedgerUpdates)
// Deposits, withdrawals, transfers
// ────────────────────────────────────────────
export async function getTransferHistory(req, res) {
    try {
        const address = normalizeAddress(req.params.address);
        if (!address) return res.status(400).json({ error: "Invalid address" });

        const endTime   = Number(req.query.endTime)   || Date.now();
        const startTime = Number(req.query.startTime) || endTime - 90 * 24 * 60 * 60 * 1000;

        const updates = await hlPost({
            type: "userNonFundingLedgerUpdates",
            user: address,
            startTime,
            endTime,
        });

        const rows = (Array.isArray(updates) ? updates : []).map(u => {
            const delta = u.delta || {};
            // delta.type can be: "deposit", "withdraw", "transfer", "accountClassTransfer", etc.
            const type = delta.type || "unknown";
            const amount = delta.usdc || delta.amount || "0";
            const isDeposit    = type === "deposit";
            const isWithdrawal = type === "withdraw";

            return {
                id:     u.hash || `${u.time}-${type}`,
                time:   u.time,
                type,
                amount,
                usd:    amount,
                isDeposit,
                isWithdrawal,
                hash:   u.hash || null,
                raw:    delta,
            };
        });

        // Sort newest first
        rows.sort((a, b) => b.time - a.time);

        // Split into deposits vs withdrawals for easy frontend filtering
        const deposits     = rows.filter(r => r.isDeposit);
        const withdrawals  = rows.filter(r => r.isWithdrawal);
        const all          = rows;

        res.json({ address, all, deposits, withdrawals, count: rows.length });
    } catch (err) {
        console.error("❌ TRANSFER HISTORY ERROR:", err);
        res.status(500).json({ error: err.message || "Failed to fetch transfer history" });
    }
}

// ────────────────────────────────────────────
// GET ALL TRADABLE MARKETS (meta)
// Used for the coin search feature
// ────────────────────────────────────────────
export async function getMarkets(req, res) {
    try {
        const meta = await hlPost({ type: "meta" });

        const coins = (meta?.universe || []).map((asset, idx) => ({
            id:          idx,
            name:        asset.name,
            maxLeverage: asset.maxLeverage,
            onlyIsolated: asset.onlyIsolated || false,
        }));

        res.json({ coins, count: coins.length });
    } catch (err) {
        console.error("❌ MARKETS ERROR:", err);
        res.status(500).json({ error: err.message || "Failed to fetch markets" });
    }
}
