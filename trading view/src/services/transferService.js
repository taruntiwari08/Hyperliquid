import { ExchangeClient, HttpTransport } from "@nktkas/hyperliquid";
import { createWalletClient, custom, encodeFunctionData, parseUnits } from "viem";
import { arbitrumSepolia } from "viem/chains"; // ← changed from arbitrum
import { erc20Abi } from "viem";

const IS_TESTNET = true;

// ── Testnet addresses ──────────────────────────────────────────
const TESTNET_BRIDGE   = "0x08cfc1B6b2dCF36A1480b99353A354AA8AC56f89";
const TESTNET_USDC     = "0x1baAbB04529D43a73232B713C0FE471f7c7334d5";
const TESTNET_CHAIN_ID = "0x66eee"; // 421614 = Arbitrum Sepolia ← was 0xa4b1 (mainnet)

// ── Mainnet addresses ──────────────────────────────────────────
const MAINNET_BRIDGE   = "0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7";
const MAINNET_USDC     = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const MAINNET_CHAIN_ID = "0xa4b1"; // 42161 = Arbitrum One

// ── Active config ──────────────────────────────────────────────
const BRIDGE_ADDRESS  = IS_TESTNET ? TESTNET_BRIDGE   : MAINNET_BRIDGE;
const USDC_ADDRESS    = IS_TESTNET ? TESTNET_USDC     : MAINNET_USDC;
const TARGET_CHAIN_ID = IS_TESTNET ? TESTNET_CHAIN_ID : MAINNET_CHAIN_ID;
const VIEM_CHAIN      = IS_TESTNET ? arbitrumSepolia  : arbitrum; // ← correct viem chain object

const getProvider = () => {
    if (!window.ethereum) throw new Error("No wallet found");
    if (window.ethereum.providers) {
        const mm = window.ethereum.providers.find((p) => p.isMetaMask);
        if (mm) return mm;
    }
    if (window.ethereum.isMetaMask) return window.ethereum;
    throw new Error("MetaMask not found");
};

const getExchangeClient = async () => {
    const provider = getProvider();
    const accounts = await provider.request({ method: "eth_requestAccounts" });
    const account = accounts[0];

    const wallet = createWalletClient({
        chain: VIEM_CHAIN, // ← uses correct chain
        transport: custom(provider),
        account,
    });

    return new ExchangeClient({
        transport: new HttpTransport({ isTestnet: IS_TESTNET }),
        wallet,
    });
};

export async function depositUSDC(amount) {
    if (Number(amount) < 5) {
        throw new Error("Minimum deposit is 5 USDC.");
    }

    const provider = getProvider();

    // Switch to correct network
    try {
        await provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: TARGET_CHAIN_ID }],
        });
    } catch (err) {
        if (err.code === 4902) {
            await provider.request({
                method: "wallet_addEthereumChain",
                params: [{
                    chainId: TARGET_CHAIN_ID,
                    chainName: IS_TESTNET ? "Arbitrum Sepolia" : "Arbitrum One",
                    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
                    rpcUrls: [IS_TESTNET
                        ? "https://sepolia-rollup.arbitrum.io/rpc"
                        : "https://arb1.arbitrum.io/rpc"
                    ],
                    blockExplorerUrls: [IS_TESTNET
                        ? "https://sepolia.arbiscan.io"
                        : "https://arbiscan.io"
                    ],
                }],
            });
        } else {
            throw err;
        }
    }

    const accounts = await provider.request({ method: "eth_requestAccounts" });
    const account = accounts[0];

    // ── fetch current base fee and add 50% buffer ──────────────────────
    const feeData = await provider.request({ method: "eth_gasPrice" });
    const gasPrice = BigInt(feeData);
    const bufferedGasPrice = gasPrice + (gasPrice * 50n) / 100n; // +50% buffer
    // ──────────────────────────────────────────────────────────────────

    const wallet = createWalletClient({
        chain: VIEM_CHAIN,
        transport: custom(provider),
        account,
    });

    const amountInUnits = parseUnits(String(amount), 6);

    const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        args: [BRIDGE_ADDRESS, amountInUnits],
    });

    const txHash = await wallet.sendTransaction({
        to: USDC_ADDRESS,
        data,
        gasPrice: bufferedGasPrice, // ← explicitly set gas price with buffer
    });

    return { txHash };
}

export async function withdrawUSDC(amount, destinationAddress) {
    const client = await getExchangeClient();

    const result = await client.withdraw3({
        destination: destinationAddress,
        amount: String(amount),
    });

    return result;
}