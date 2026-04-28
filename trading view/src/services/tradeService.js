const BASE_URL = "http://localhost:3000";

export async function placeTrade({ coin, isLong, size, leverage }) {
    try {
        const res = await fetch(`${BASE_URL}/trade`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                coin,
                isLong,
                size,
                leverage
            })
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || "Trade failed");
        }

        return data;

    } catch (err) {
        console.error("TRADE API ERROR:", err);
        return { error: err.message };
    }
}