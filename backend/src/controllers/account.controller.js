import { infoClient } from "../utils/hyperliquid.js";
import { normalizeAddress } from "../utils/validators.js";

export async function getBalance(req, res) {
    try {
        const address = normalizeAddress(req.params.address);

        if (!address) {
            return res.status(400).json({
                error: "Invalid address",
            });
        }

        const state = await infoClient.clearinghouseState({
            user: address,
        });

        res.json({
            address,
            balance: state?.marginSummary?.accountValue || "0",
            accountValue: state?.marginSummary?.accountValue || "0",
            withdrawable: state?.withdrawable || "0",
            totalRawUsd: state?.marginSummary?.totalRawUsd || "0",
            totalMarginUsed: state?.marginSummary?.totalMarginUsed || "0",
        });
    } catch (err) {
        console.error("❌ BALANCE ERROR:", err);

        if (err?.message?.includes("does not exist")) {
            return res.json({
                address: req.params.address,
                balance: "0",
                accountValue: "0",
                withdrawable: "0",
                totalRawUsd: "0",
                totalMarginUsed: "0",
            });
        }

        res.status(500).json({
            error: err.message,
        });
    }
}

export async function getDebugState(req, res) {
    try {
        const address = normalizeAddress(req.params.address);

        if (!address) {
            return res.status(400).json({
                error: "Invalid address",
            });
        }

        const state = await infoClient.clearinghouseState({
            user: address,
        });

        res.json(state);
    } catch (err) {
        res.status(500).json({
            error: err.message,
        });
    }
}

export async function getPositions(req, res) {
    try {
        const address = normalizeAddress(req.params.address);

        if (!address) {
            return res.status(400).json({
                error: "Invalid address",
            });
        }

        const state = await infoClient.clearinghouseState({
            user: address,
        });

        res.json({
            address,
            positions: state?.assetPositions || [],
        });
    } catch (err) {
        console.error("❌ POSITIONS ERROR:", err);

        res.status(500).json({
            error: err.message,
        });
    }
}

export async function getBuilderStats(req, res) {
    try {
        const address = normalizeAddress(req.params.address);

        if (!address) {
            return res.status(400).json({
                error: "Invalid address",
            });
        }

        const result = await infoClient.referral({
            user: address,
        });

        res.json(result);
    } catch (err) {
        console.error("❌ BUILDER STATS ERROR:", err);

        res.status(500).json({
            error: err.message || "failed to fetch builder stats",
        });
    }
}