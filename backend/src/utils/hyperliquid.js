import {
    HttpTransport,
    InfoClient,
    ExchangeClient,
} from "@nktkas/hyperliquid";

import { SymbolConverter } from "@nktkas/hyperliquid/utils";

import { privateKeyToAccount } from "viem/accounts";

const isTestnet = process.env.HL_IS_TESTNET === "true";

export const transport = new HttpTransport({
    isTestnet,
});

export const infoClient = new InfoClient({
    transport,
});

export let converter = null;

export async function initSymbolConverter() {
    converter = await SymbolConverter.create({ transport });

    console.log("✅ Symbol converter ready");
}

export function createExchangeClientFromPrivateKey(privateKey) {
    const wallet = privateKeyToAccount(privateKey);

    return new ExchangeClient({
        transport,
        wallet,
    });
}