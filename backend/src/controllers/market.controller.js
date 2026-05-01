import { infoClient } from "../utils/hyperliquid.js";

export async function getPrices(req, res) {
    try {
        const mids = await infoClient.allMids();

        res.json(mids);
    } catch (err) {
        res.status(500).json({
            error: "price fetch failed",
        });
    }
}