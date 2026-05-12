const HL_INFO_URL =
    process.env.HL_IS_TESTNET === "true"
        ? "https://api.hyperliquid-testnet.xyz/info"
        : "https://api.hyperliquid.xyz/info";

const VALID_INTERVALS = new Set([
    "1m",
    "3m",
    "5m",
    "15m",
    "30m",
    "1h",
    "2h",
    "4h",
    "8h",
    "12h",
    "1d",
    "3d",
    "1w",
    "1M",
]);

const INTERVAL_MS = {
    "1m": 60 * 1000,
    "3m": 3 * 60 * 1000,
    "5m": 5 * 60 * 1000,
    "15m": 15 * 60 * 1000,
    "30m": 30 * 60 * 1000,
    "1h": 60 * 60 * 1000,
    "2h": 2 * 60 * 60 * 1000,
    "4h": 4 * 60 * 60 * 1000,
    "8h": 8 * 60 * 60 * 1000,
    "12h": 12 * 60 * 60 * 1000,
    "1d": 24 * 60 * 60 * 1000,
    "3d": 3 * 24 * 60 * 60 * 1000,
    "1w": 7 * 24 * 60 * 60 * 1000,
    "1M": 30 * 24 * 60 * 60 * 1000,
};

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

function safeCoin(coin) {
    if (!coin || typeof coin !== "string") return null;

    const trimmed = coin.trim();

    if (!/^[a-zA-Z0-9_-]{1,30}$/.test(trimmed)) {
        return null;
    }

    return trimmed;
}

export async function getCandles(req, res) {
    try {
        const coin = safeCoin(req.params.coin);
        const interval = req.query.interval || "15m";

        if (!coin) {
            return res.status(400).json({
                error: "invalid coin",
            });
        }

        if (!VALID_INTERVALS.has(interval)) {
            return res.status(400).json({
                error: "invalid interval",
            });
        }

        const now = Date.now();
        const intervalMs = INTERVAL_MS[interval] || INTERVAL_MS["15m"];

        const endTime = Number(req.query.endTime || now);
        const startTime = Number(
            req.query.startTime || endTime - intervalMs * 300
        );

        const candles = await hyperliquidInfo({
            type: "candleSnapshot",
            req: {
                coin,
                interval,
                startTime,
                endTime,
            },
        });

        res.json({
            coin,
            interval,
            startTime,
            endTime,
            candles: Array.isArray(candles) ? candles : [],
        });
    } catch (err) {
        console.error("❌ CANDLE ERROR:", err);

        res.status(500).json({
            error: err.message || "failed to fetch candles",
        });
    }
}