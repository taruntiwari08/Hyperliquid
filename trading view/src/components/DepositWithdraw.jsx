import React, { useState } from "react";
import { useAccount } from "wagmi";
import { useBalance } from "../hooks/useBalance";
import { depositUSDC, withdrawUSDC } from "../services/transferService";

const QUICK_AMOUNTS = [10, 50, 100, 500];

const TransferPanel = () => {
    const { address, isConnected } = useAccount();
    const balance = useBalance(address);

    const [tab, setTab] = useState("deposit");
    const [amount, setAmount] = useState("");
    const [loading, setLoading] = useState(false);
    const [txHash, setTxHash] = useState(null);
    const [error, setError] = useState(null);

    const numericAmount = Number(amount);
    const isValidAmount = Number.isFinite(numericAmount) && numericAmount > 0;

    const resetStatus = () => {
        setError(null);
        setTxHash(null);
    };

    const updateAmount = (value) => {
        setAmount(value);
        resetStatus();
    };

    const selectTab = (nextTab) => {
        setTab(nextTab);
        resetStatus();
    };

    const handleDeposit = async () => {
        if (!isValidAmount) {
            setError("Enter a valid amount");
            return;
        }

        // if (numericAmount < 5) {
        //     setError("Minimum deposit is $5 USDC");
        //     return;
        // }

        try {
            setLoading(true);
            resetStatus();

            const res = await depositUSDC(amount);
            setTxHash(res.txHash);
            setAmount("");
            alert(`Deposit submitted! Tx: ${res.txHash}\nFunds arrive in about 1-2 minutes.`);
        } catch (err) {
            console.error("Deposit error:", err);
            setError(err.message || "Deposit failed");
        } finally {
            setLoading(false);
        }
    };

    const handleWithdraw = async () => {
        if (!isValidAmount) {
            setError("Enter a valid amount");
            return;
        }

        if (!address) {
            setError("Connect wallet first");
            return;
        }

        if (numericAmount > Number(balance || 0)) {
            setError("Amount exceeds available balance");
            return;
        }

        try {
            setLoading(true);
            resetStatus();

            const res = await withdrawUSDC(amount, address);
            setAmount("");
            alert("Withdrawal initiated. Funds will arrive on Arbitrum shortly.");
            console.log("Withdraw result:", res);
        } catch (err) {
            console.error("Withdraw error:", err);
            setError(err.message || "Withdrawal failed");
        } finally {
            setLoading(false);
        }
    };

    if (!isConnected) {
        return (
            <div className="bg-[#0b1220] text-white p-4 border border-[#1e293b] shadow-xl mt-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-2">Deposit / Withdraw</h3>
                <p className="text-xs text-gray-500">Connect wallet to transfer funds.</p>
            </div>
        );
    }

    return (
        <div className="bg-[#0b1220] text-white p-4 border border-[#1e293b] shadow-xl mt-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Deposit / Withdraw</h3>

            <div className="text-xs text-gray-400 mb-3">
                Available Balance:{" "}
                <span className="text-white font-semibold">${balance || "0"} USDC</span>
            </div>

            <div className="flex bg-[#111827] rounded-xl overflow-hidden mb-4">
                <button
                    type="button"
                    onClick={() => selectTab("deposit")}
                    className={`flex-1 py-2 text-sm font-semibold ${
                        tab === "deposit" ? "bg-blue-600 text-white" : "text-gray-400"
                    }`}
                >
                    Deposit
                </button>
                <button
                    type="button"
                    onClick={() => selectTab("withdraw")}
                    className={`flex-1 py-2 text-sm font-semibold ${
                        tab === "withdraw" ? "bg-orange-500 text-white" : "text-gray-400"
                    }`}
                >
                    Withdraw
                </button>
            </div>

            <div className="text-xs text-gray-500 mb-3 bg-[#111827] rounded p-2">
                {tab === "deposit" ? (
                    <>
                        <p>
                            Deposit USDC from{" "}
                            <span className="text-blue-400">Arbitrum One</span> to Hyperliquid.
                        </p>
                        <p className="mt-1">Minimum: $5 USDC. Funds arrive in about 1-2 min.</p>
                        <p className="mt-1 text-yellow-400">
                            Your wallet will switch to Arbitrum automatically.
                        </p>
                    </>
                ) : (
                    <>
                        <p>
                            Withdraw USDC from Hyperliquid to your{" "}
                            <span className="text-orange-400">Arbitrum wallet</span>.
                        </p>
                        <p className="mt-1">
                            Destination: <span className="text-white break-all">{address}</span>
                        </p>
                        <p className="mt-1 text-yellow-400">
                            Sign the withdrawal request with MetaMask.
                        </p>
                    </>
                )}
            </div>

            <input
                type="number"
                placeholder="Amount (USDC)"
                value={amount}
                onChange={(e) => updateAmount(e.target.value)}
                className="w-full p-2 bg-[#111827] rounded mb-3 text-white text-sm"
                min="0"
                step="0.01"
            />

            <div className="flex gap-2 mb-3">
                {QUICK_AMOUNTS.map((value) => (
                    <button
                        key={value}
                        type="button"
                        onClick={() => updateAmount(String(value))}
                        className="flex-1 bg-[#111827] hover:bg-[#1f2937] text-gray-400 text-xs py-1 rounded"
                    >
                        ${value}
                    </button>
                ))}
            </div>

            {error && (
                <div className="text-xs text-red-400 mb-3 bg-red-900/20 p-2 rounded">
                    {error}
                </div>
            )}

            {txHash && (
                <div className="text-xs text-green-400 mb-3 break-all bg-green-900/20 p-2 rounded">
                    Tx:{" "}
                    <a
                        href={`https://arbiscan.io/tx/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                    >
                        {txHash.slice(0, 20)}...
                    </a>
                </div>
            )}

            <button
                type="button"
                onClick={tab === "deposit" ? handleDeposit : handleWithdraw}
                disabled={loading || !amount}
                className={`w-full py-3 rounded font-semibold text-sm ${
                    loading || !amount
                        ? "bg-gray-600 cursor-not-allowed"
                        : tab === "deposit"
                          ? "bg-blue-600 hover:bg-blue-700"
                          : "bg-orange-500 hover:bg-orange-600"
                }`}
            >
                {loading
                    ? tab === "deposit"
                        ? "Sending to Bridge..."
                        : "Requesting Withdrawal..."
                    : tab === "deposit"
                      ? `Deposit ${amount || "?"} USDC`
                      : `Withdraw ${amount || "?"} USDC`}
            </button>
        </div>
    );
};

export default TransferPanel;
