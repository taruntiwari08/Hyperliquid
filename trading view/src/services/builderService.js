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

export async function approveBuilderFee(builderAddress, feeRate) {
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

        await client.approveBuilderFee({
            builder: builderAddress,
            maxFeeRate: feeRate,
        });

        return { success: true };
    } catch (err) {
        console.error("BUILDER APPROVAL ERROR:", err);
        throw err;
    }
}