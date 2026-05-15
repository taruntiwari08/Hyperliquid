import { useEffect, useState } from "react";
import { BASE_URL } from "../config/base";

export function usePositions(address) {
    const [positions, setPositions] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!address) {
            setPositions([]);
            setSummary(null);
            return;
        }

        let isMounted = true;

        const fetchPositions = async () => {
            try {
                setLoading(true);

                const res = await fetch(`${BASE_URL}/positions/${address}`);
                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data?.error || "Failed to fetch positions");
                }

                if (isMounted) {
                    setPositions(Array.isArray(data.positions) ? data.positions : []);

                    setSummary({
                        accountValue: data.accountValue || "0",
                        withdrawable: data.withdrawable || "0",
                        totalMarginUsed: data.totalMarginUsed || "0",
                    });

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

    return {
        positions,
        summary,
        loading,
        error,
    };
}