// src/services/hyperliquid.js
import { BASE_URL } from "../config/base";

export const getPrices = async () => {
    try {
        const res = await fetch(`${BASE_URL}/market-contexts`);
        return await res.json();
    } catch (err) {
        console.error("Price fetch error:", err);
        return {};
    }
};