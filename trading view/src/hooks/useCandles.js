import { useCallback, useEffect, useState } from "react";
import { BASE_URL } from "../config/base";

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
};

export function useCandles(coin, interval = "15m") {
    const [candles, setCandles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchCandles = useCallback(async () => {
        if (!coin) {
            setCandles([]);
            return;
        }

        try {
            setLoading(true);

            const endTime = Date.now();
            const intervalMs = INTERVAL_MS[interval] || INTERVAL_MS["15m"];
            const candleLimit = 180;
            const startTime = endTime - intervalMs * candleLimit;

            const url =
                `${BASE_URL}/candles/${coin}` +
                `?interval=${interval}` +
                `&startTime=${startTime}` +
                `&endTime=${endTime}`;

            const res = await fetch(url);
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data?.error || "Failed to fetch candles");
            }

            const formatted = (data.candles || [])
                .map((candle) => ({
                    time: Math.floor(Number(candle.t) / 1000),
                    open: Number(candle.o),
                    high: Number(candle.h),
                    low: Number(candle.l),
                    close: Number(candle.c),
                    volume: Number(candle.v || 0),
                }))
                .filter((candle) => {
                    return (
                        candle.time &&
                        candle.open &&
                        candle.high &&
                        candle.low &&
                        candle.close
                    );
                });

            setCandles(formatted);
            setError(null);
        } catch (err) {
            console.error("Candles error:", err);
            setError(err.message || "Failed to fetch candles");
        } finally {
            setLoading(false);
        }
    }, [coin, interval]);

    useEffect(() => {
        fetchCandles();

        const timer = setInterval(fetchCandles, 15000);

        return () => clearInterval(timer);
    }, [fetchCandles]);

    return {
        candles,
        loading,
        error,
        refresh: fetchCandles,
    };
}