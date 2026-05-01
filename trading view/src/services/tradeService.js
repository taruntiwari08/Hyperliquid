const BASE_URL = "http://localhost:3000";

export async function placeTrade({
    userAddress,
    coin,
    isLong,
    size,
    leverage,
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
                size,
                leverage,
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