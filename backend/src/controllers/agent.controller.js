import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import AgentWallet from "../models/AgentWallet.js";
import { encryptPrivateKey } from "../utils/crypto.js";
import { normalizeAddress } from "../utils/validators.js";

export async function createAgent(req, res) {
    try {
        const userAddress = normalizeAddress(req.body.userAddress);

        if (!userAddress) {
            return res.status(400).json({
                error: "Invalid user address",
            });
        }

        const existing = await AgentWallet.findOne({ userAddress });

        if (existing) {
            return res.json({
                success: true,
                alreadyExists: true,
                userAddress: existing.userAddress,
                agentAddress: existing.agentAddress,
                agentName: existing.agentName,
                isApproved: existing.isApproved,
                validUntil: existing.validUntil,
            });
        }

        const agentPrivateKey = generatePrivateKey();
        const agentWallet = privateKeyToAccount(agentPrivateKey);

        const validUntil = Date.now() + 180 * 24 * 60 * 60 * 1000;

        const agentName = `br-${userAddress.slice(2, 8)}`;

        const encryptedPrivateKey = encryptPrivateKey(agentPrivateKey);

        const doc = await AgentWallet.create({
            userAddress,
            agentAddress: agentWallet.address.toLowerCase(),
            agentName,
            encryptedPrivateKey,
            validUntil,
            isApproved: false,
        });

        console.log("✅ Agent created:", {
            userAddress,
            agentAddress: doc.agentAddress,
            agentName: doc.agentName,
        });

        res.json({
            success: true,
            alreadyExists: false,
            userAddress: doc.userAddress,
            agentAddress: doc.agentAddress,
            agentName: doc.agentName,
            isApproved: doc.isApproved,
            validUntil: doc.validUntil,
        });
    } catch (err) {
        console.error("❌ CREATE AGENT ERROR:", err);

        res.status(500).json({
            error: err.message || "failed to create agent",
        });
    }
}

export async function getAgent(req, res) {
    try {
        const userAddress = normalizeAddress(req.params.userAddress);

        if (!userAddress) {
            return res.status(400).json({
                error: "Invalid user address",
            });
        }

        const agent = await AgentWallet.findOne({ userAddress });

        if (!agent) {
            return res.json({
                exists: false,
                userAddress,
            });
        }

        res.json({
            exists: true,
            userAddress: agent.userAddress,
            agentAddress: agent.agentAddress,
            agentName: agent.agentName,
            isApproved: agent.isApproved,
            validUntil: agent.validUntil,
            createdAt: agent.createdAt,
            updatedAt: agent.updatedAt,
        });
    } catch (err) {
        res.status(500).json({
            error: err.message || "failed to fetch agent",
        });
    }
}

export async function markAgentApproved(req, res) {
    try {
        const userAddress = normalizeAddress(req.body.userAddress);

        if (!userAddress) {
            return res.status(400).json({
                error: "Invalid user address",
            });
        }

        const agent = await AgentWallet.findOne({ userAddress });

        if (!agent) {
            return res.status(404).json({
                error: "Agent not found",
            });
        }

        agent.isApproved = true;

        await agent.save();

        res.json({
            success: true,
            userAddress: agent.userAddress,
            agentAddress: agent.agentAddress,
            isApproved: agent.isApproved,
        });
    } catch (err) {
        res.status(500).json({
            error: err.message || "failed to mark agent approved",
        });
    }
}