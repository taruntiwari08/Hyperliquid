import { BASE_URL } from "../config/base";

export async function getTradePreview({
    userAddress,
    coin,
    isLong,
    margin,
    leverage,
}) {
    try {
        const res = await fetch(`${BASE_URL}/trade/preview`, {
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
            }),
        });

        const data = await res.json();

        if (!res.ok) {
            return {
                error: data?.error || "Preview failed",
            };
        }

        return data;
    } catch (err) {
        console.error("Trade preview error:", err);

        return {
            error: err.message || "Preview failed",
        };
    }
}