// src/services/hyperliquid.js

const BASE_URL = "https://hyperliquid-rho.vercel.app";

export const getPrices = async () => {
    try {
        const res = await fetch(`${BASE_URL}/prices`);
        return await res.json();
    } catch (err) {
        console.error("Price fetch error:", err);
        return {};
    }
};