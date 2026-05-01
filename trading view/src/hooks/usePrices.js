import { useEffect, useState } from "react";

export function usePrices() {
    const [prices, setPrices] = useState(null);

    useEffect(() => {
        const fetchPrices = async () => {
            try {
                const res = await fetch("https://hyperliquid-rho.vercel.app/prices");
                const data = await res.json();

                console.log("PRICE DATA:", data); // DEBUG

                setPrices(data);
            } catch (err) {
                console.log("Price error:", err);
            }
        };

        fetchPrices();

        const interval = setInterval(fetchPrices, 2000); // realtime update

        return () => clearInterval(interval);
    }, []);

    return prices;
}