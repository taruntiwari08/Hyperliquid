import { useEffect, useState } from "react";
import { BASE_URL } from "../config/base";

export function usePrices() {
    const [prices, setPrices] = useState({});

    useEffect(() => {
        let mounted = true;

        const fetchPrices = async () => {
            try {
                const res = await fetch(`${BASE_URL}/market-contexts`);
                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data?.error || "Failed to fetch prices");
                }

                const markets = Array.isArray(data?.markets)
                    ? data.markets
                    : [];

                const priceMap = {};

                for (const market of markets) {
                    if (!market?.coin) continue;

                    // Prefer markPx because this matches official Hyperliquid UI better.
                    // fallback: midPx -> oraclePx
                    priceMap[market.coin] =
                        market.markPx ??
                        market.midPx ??
                        market.oraclePx ??
                        null;
                }

                if (mounted) {
                    setPrices(priceMap);
                }
            } catch (err) {
                console.log("Price error:", err);

                if (mounted) {
                    setPrices({});
                }
            }
        };

        fetchPrices();

        const interval = setInterval(fetchPrices, 3000);

        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, []);

    return prices;
}