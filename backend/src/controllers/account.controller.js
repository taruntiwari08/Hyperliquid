import { infoClient } from "../utils/hyperliquid.js";
import { normalizeAddress } from "../utils/validators.js";
import { decryptPrivateKey } from "../utils/crypto.js";
import { createExchangeClientFromPrivateKey } from "../utils/hyperliquid.js";
import AgentWallet from "../models/AgentWallet.js";


const HL_INFO_URL =
    process.env.HL_IS_TESTNET === "true"
        ? "https://api.hyperliquid-testnet.xyz/info"
        : "https://api.hyperliquid.xyz/info";

async function hyperliquidInfo(body) {
    const res = await fetch(HL_INFO_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

    const text = await res.text();

    if (!res.ok) {
        throw new Error(text || "Hyperliquid info request failed");
    }

    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

export async function getOpenOrders(req, res) {
    try {
        const address = normalizeAddress(req.params.address);

        if (!address) {
            return res.status(400).json({
                error: "Invalid address",
            });
        }

        const orders = await hyperliquidInfo({
            type: "frontendOpenOrders",
            user: address,
        });

        res.json({
            address,
            orders: Array.isArray(orders) ? orders : [],
        });
    } catch (err) {
        console.error("❌ OPEN ORDERS ERROR:", err);

        res.status(500).json({
            error: err.message || "failed to fetch open orders",
        });
    }
}

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