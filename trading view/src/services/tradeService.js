import { BASE_URL } from "../config/base";

export async function placeTrade({
    userAddress,
    coin,
    isLong,
    margin,
    leverage,
    tpPrice,
    slPrice,
}) {
    try {
        const res = await fetch(`${BASE_URL}/trade`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                userAddress,
                coin,
                isLong,
                margin,
                leverage,
                tpPrice,
                slPrice,
            }),
        });

        const data = await res.json();

        if (!res.ok) {
            return {
                error: data?.error || "Trade failed",
            };
        }

        return data;
    } catch (err) {
        console.error("Trade API Error:", err);

        return {
            error: err.message || "Trade failed",
        };
    }
}