import { useEffect, useState } from "react";
import { BASE_URL } from "../config/base";

export function usePositions(address) {
    const [positions, setPositions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!address) {
            setPositions([]);
            return;
        }

        let isMounted = true;

        const fetchPositions = async () => {
            try {
                setLoading(true);

                const [positionsRes, pricesRes] = await Promise.all([
                    fetch(`${BASE_URL}/positions/${address}`),
                    fetch(`${BASE_URL}/market-contexts`),
                ]);

                const positionsData = await positionsRes.json();
                const prices = await pricesRes.json();

                const activePositions = (positionsData.positions || [])
                    .filter((item) => Number(item.position?.szi || 0) !== 0)
                    .map((item) => {
                        const p = item.position;

                        const coin = p.coin;
                        const rawSize = Number(p.szi || 0);
                        const absSize = Math.abs(rawSize);
                        const entryPrice = Number(p.entryPx || 0);
                        const markPrice = Number(prices?.[coin] || 0);

                        const isLong = rawSize > 0;
                        const side = isLong ? "LONG" : "SHORT";

                        const pnl = Number(p.unrealizedPnl || 0);
                        const pnlPercent = Number(p.returnOnEquity || 0) * 100;

                        return {
                            coin,
                            side,
                            isLong,

                            size: rawSize,
                            absSize,

                            entryPrice,
                            markPrice,

                            pnl,
                            pnlPercent,

                            // ✅ REAL values from Hyperliquid
                            liquidationPrice: Number(p.liquidationPx || 0),
                            marginUsed: Number(p.marginUsed || 0),
                            positionValue: Number(p.positionValue || 0),
                            leverage: Number(p.leverage?.value || 0),
                            maxLeverage: Number(p.maxLeverage || 0),

                            raw: item,
                        };
                    });

                if (isMounted) {
                    setPositions(activePositions);
                    setError(null);
                }
            } catch (err) {
                console.log("Positions error:", err);
                if (isMounted) {
                    setError(err.message || "Failed to fetch positions");
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchPositions();

        const interval = setInterval(fetchPositions, 3000);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [address]);

    return { positions, loading, error };
}