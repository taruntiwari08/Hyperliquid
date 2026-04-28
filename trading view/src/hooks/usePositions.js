import { useEffect, useState } from "react";

const BASE_URL = "http://localhost:3000";

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
                    fetch(`${BASE_URL}/prices`),
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

                        const pnl =
                            entryPrice && markPrice
                                ? isLong
                                    ? ((markPrice - entryPrice) / entryPrice) * absSize
                                    : ((entryPrice - markPrice) / entryPrice) * absSize
                                : 0;

                        const pnlPercent =
                            entryPrice && markPrice
                                ? isLong
                                    ? ((markPrice - entryPrice) / entryPrice) * 100
                                    : ((entryPrice - markPrice) / entryPrice) * 100
                                : 0;

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
                            raw: item,
                        };
                    });

                if (isMounted) {
                    setPositions(activePositions);
                    setError(null);
                }
            } catch (err) {
                console.log("Positions error:", err);
                if (isMounted) setError(err.message || "Failed to fetch positions");
            } finally {
                if (isMounted) setLoading(false);
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