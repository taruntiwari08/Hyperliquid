import { ExchangeClient, HttpTransport } from "@nktkas/hyperliquid";
import { createWalletClient, custom } from "viem";
import { arbitrum } from "viem/chains";
import { BASE_URL, isTestnet } from "../config/base";

const getMetaMaskProvider = () => {
    if (!window.ethereum) {
        throw new Error("No wallet found");
    }

    if (window.ethereum.providers) {
        const metamask = window.ethereum.providers.find((p) => p.isMetaMask);
        if (metamask) return metamask;
    }

    if (window.ethereum.isMetaMask) {
        return window.ethereum;
    }

    throw new Error("MetaMask not found");
};

// =====================================
// CREATE OR GET USER AGENT FROM BACKEND
// =====================================
export async function createOrGetAgent(userAddress) {
    const res = await fetch(`${BASE_URL}/agent/create`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            userAddress,
        }),
    });

    const data = await res.json();

    if (!res.ok) {
        throw new Error(data?.error || "Failed to create agent");
    }

    return data;
}

// =====================================
// GET EXISTING AGENT
// =====================================
export async function getAgent(userAddress) {
    const res = await fetch(`${BASE_URL}/agent/${userAddress}`);
    const data = await res.json();

    if (!res.ok) {
        throw new Error(data?.error || "Failed to get agent");
    }

    return data;
}

// =====================================
// MARK AGENT APPROVED IN DB
// =====================================
export async function markAgentApproved(userAddress) {
    const res = await fetch(`${BASE_URL}/agent/approved`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            userAddress,
        }),
    });

    const data = await res.json();

    if (!res.ok) {
        throw new Error(data?.error || "Failed to mark agent approved");
    }

    return data;
}

// =====================================
// APPROVE AGENT ON HYPERLIQUID
// =====================================
export async function approveAgent(agentAddress, agentName) {
    try {
        const provider = getMetaMaskProvider();

        const accounts = await provider.request({
            method: "eth_requestAccounts",
        });

        const account = accounts[0];

        if (!account) {
            throw new Error("No account connected");
        }

        const wallet = createWalletClient({
            chain: arbitrum,
            transport: custom(provider),
            account,
        });

        const client = new ExchangeClient({
            transport: new HttpTransport({ isTestnet }),
            wallet,
        });

        await client.approveAgent({
            agentAddress,
            agentName,
        });

        return { success: true };
    } catch (err) {
        console.error("APPROVE AGENT ERROR:", err);
        throw err;
    }
}