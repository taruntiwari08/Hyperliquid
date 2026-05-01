import { useEffect, useState } from "react";

const BASE_URL = "https://hyperliquid-rho.vercel.app";

export function useBalance(address) {
    const [balance, setBalance] = useState(null);

    useEffect(() => {
        if (!address) return;

        const fetchBalance = async () => {
            try {
                const res = await fetch(`${BASE_URL}/balance/${address}`);
                const data = await res.json();

                setBalance(data.balance);
            } catch (err) {
                console.log("Balance error:", err);
            }
        };

        fetchBalance();

        const interval = setInterval(fetchBalance, 4000);
        return () => clearInterval(interval);

    }, [address]);

    return balance;
}