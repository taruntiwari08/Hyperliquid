const BASE_URL = "https://hyperliquid-rho.vercel.app";

export async function closePosition({ coin, address }) {
    try {
        const res = await fetch(`${BASE_URL}/close-position`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                coin,
                address,
            }),
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data?.error || "Close failed");
        }

        return data;
    } catch (err) {
        console.error("Close API Error:", err);
        return { error: err.message };
    }
}