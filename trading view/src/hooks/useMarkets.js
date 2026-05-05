import { useEffect, useState } from "react";
import { BASE_URL } from "../config/base";

export function useMarkets() {
    const [coins,   setCoins]   = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        window.fetch(`${BASE_URL}/markets`)
            .then(r => r.json())
            .then(d => setCoins(d.coins || []))
            .catch(() => setCoins([]))
            .finally(() => setLoading(false));
    }, []);

    return { coins, loading };
}
