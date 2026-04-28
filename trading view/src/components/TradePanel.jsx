import React, { useState, useEffect } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { usePrices } from "../hooks/usePrices";
import { placeTrade } from "../services/tradeService";
import { approveAgent } from "../services/agentService";
import { useBalance } from "../hooks/useBalance";

// ✅ NEW
import { closePosition } from "../services/closeService";

const TradePanel = () => {
    const { isConnected, address } = useAccount();

    const prices = usePrices();
    const balance = useBalance(address);

    const [activeTab, setActiveTab] = useState("long");
    const [orderType, setOrderType] = useState("market");

    const [leverage, setLeverage] = useState(5);
    const [margin, setMargin] = useState("");
    const [size, setSize] = useState("");
    const [coin, setCoin] = useState("BTC");

    const [loading, setLoading] = useState(false);
    const [closing, setClosing] = useState(false);
    const [approving, setApproving] = useState(false);

    const [agentApproved, setAgentApproved] = useState(false);

    const AGENT_ADDRESS = "0x4A04b217a88BAEEEbc6A726A6411Ce2A74176fC2";

    const currentPrice = Number(prices?.[coin] || 0);
    const numericMargin = Number(margin || 0);
    const numericLeverage = Number(leverage || 1);
    const positionSize = Number(size || 0);

    const estimatedEntry = currentPrice;

    const estimatedLiquidation =
        estimatedEntry && numericLeverage
            ? activeTab === "long"
                ? estimatedEntry * (1 - 1 / numericLeverage)
                : estimatedEntry * (1 + 1 / numericLeverage)
            : 0;

    // rough taker fee estimate, adjust later with real HL fee tier
    const estimatedFeeRate = 0.00045; // 0.045%
    const estimatedFee = positionSize * estimatedFeeRate;

    // =====================================
    // 🔥 LOAD APPROVAL STATE
    // =====================================
    useEffect(() => {
        if (!address) return;

        const saved = localStorage.getItem(`agentApproved_${address}`);
        if (saved === "true") setAgentApproved(true);
    }, [address]);

    // =====================================
    // 🔥 AUTO SIZE
    // =====================================
    useEffect(() => {
        const m = Number(margin);
        const lev = Number(leverage);

        if (m > 0 && lev > 0) {
            setSize((m * lev).toFixed(2));
        } else {
            setSize("");
        }
    }, [margin, leverage]);

    // =====================================
    // ✅ APPROVE AGENT
    // =====================================
    const handleApproveAgent = async () => {
        try {
            setApproving(true);

            await approveAgent(AGENT_ADDRESS);

            setAgentApproved(true);
            localStorage.setItem(`agentApproved_${address}`, "true");

            alert("✅ Agent Approved");
        } catch (err) {
            console.error(err);
            alert("❌ Approval failed");
        } finally {
            setApproving(false);
        }
    };

    // =====================================
    // 🚀 OPEN TRADE
    // =====================================
    const handleTrade = async () => {
        try {
            setLoading(true);

            const res = await placeTrade({
                coin,
                isLong: activeTab === "long",
                size: Number(size),
                leverage: Number(leverage),
            });

            if (res?.error) alert(res.error);
            else alert("✅ Trade executed");

        } catch (err) {
            console.error(err);
            alert("❌ Trade error");
        } finally {
            setLoading(false);
        }
    };

    // =====================================
    // ❌ CLOSE POSITION
    // =====================================
    const handleClose = async () => {
        try {
            setClosing(true);

            const res = await closePosition(coin);

            console.log("CLOSE RESULT:", res);

            if (res?.error) {
                alert("❌ " + res.error);
            } else {
                alert("✅ Position Closed");
            }

        } catch (err) {
            console.error(err);
            alert("❌ Close error");
        } finally {
            setClosing(false);
        }
    };

    const canTrade =
        agentApproved &&
        Number(margin) > 0 &&
        Number(margin) <= Number(balance || 0) &&
        !loading;

    return (
        <div className="w-full bg-[#0b1220] text-white p-4 border border-[#1e293b] shadow-xl">

            {/* PRICE */}
            <div className="text-xs text-gray-400 mb-2">
                {coin} Price: ${prices?.[coin] || "loading..."}
            </div>

            {/* BALANCE */}
            <div className="text-xs text-gray-400 mb-2">
                Balance: ${balance || "0"}
            </div>

            {/* APPROVE */}
            {isConnected && (
                <button
                    onClick={handleApproveAgent}
                    disabled={approving || agentApproved}
                    className="w-full bg-yellow-500 text-black py-2 rounded mb-3 font-semibold"
                >
                    {agentApproved
                        ? "Agent Approved ✅"
                        : approving
                            ? "Approving..."
                            : "Approve Agent"}
                </button>
            )}

            {/* CONTROLS */}
            <div className="flex gap-2 mb-4">
                <select
                    value={leverage}
                    onChange={(e) => setLeverage(Number(e.target.value))}
                    className="bg-[#111827] px-3 py-2 rounded-lg text-sm w-1/3"
                >
                    <option value={2}>2x</option>
                    <option value={5}>5x</option>
                    <option value={10}>10x</option>
                </select>

                <select
                    value={coin}
                    onChange={(e) => setCoin(e.target.value)}
                    className="bg-[#111827] px-3 py-2 rounded-lg text-sm w-1/3"
                >
                    <option value="BTC">BTC</option>
                    <option value="ETH">ETH</option>
                    <option value="SOL">SOL</option>
                </select>

                <select className="bg-[#111827] px-3 py-2 rounded-lg text-sm w-1/3">
                    <option>USDC</option>
                </select>
            </div>

            {/* LONG / SHORT */}
            <div className="flex bg-[#111827] rounded-xl overflow-hidden mb-4">
                <button
                    onClick={() => setActiveTab("long")}
                    className={`flex-1 py-2 ${activeTab === "long"
                        ? "bg-green-500 text-black"
                        : "text-gray-400"
                        }`}
                >
                    Long
                </button>

                <button
                    onClick={() => setActiveTab("short")}
                    className={`flex-1 py-2 ${activeTab === "short"
                        ? "bg-red-500 text-black"
                        : "text-gray-400"
                        }`}
                >
                    Short
                </button>
            </div>

            {/* MARGIN */}
            <input
                type="number"
                placeholder="Margin (USDC)"
                value={margin}
                onChange={(e) => setMargin(e.target.value)}
                className="w-full p-2 bg-[#111827] rounded mb-3"
            />

            {/* SIZE */}
            <input
                type="number"
                value={size}
                readOnly
                className="w-full p-2 bg-[#111827] rounded mb-3 opacity-70"
            />

            {/* TRADE PREVIEW */}
            <div className="bg-[#111827] rounded mb-3 p-3 text-xs text-gray-400 space-y-2">
                <div className="flex justify-between">
                    <span>Entry Price</span>
                    <span className="text-white">
                        ${estimatedEntry ? estimatedEntry.toFixed(2) : "-"}
                    </span>
                </div>

                <div className="flex justify-between">
                    <span>Position Size</span>
                    <span className="text-white">
                        ${positionSize ? positionSize.toFixed(2) : "-"}
                    </span>
                </div>

                <div className="flex justify-between">
                    <span>Margin Used</span>
                    <span className="text-white">
                        ${numericMargin ? numericMargin.toFixed(2) : "-"}
                    </span>
                </div>

                <div className="flex justify-between">
                    <span>Leverage</span>
                    <span className="text-white">{numericLeverage}x</span>
                </div>

                <div className="flex justify-between">
                    <span>Est. Liquidation</span>
                    <span className="text-red-400">
                        ${estimatedLiquidation ? estimatedLiquidation.toFixed(2) : "-"}
                    </span>
                </div>

                <div className="flex justify-between">
                    <span>Est. Fee</span>
                    <span className="text-yellow-400">
                        ${estimatedFee ? estimatedFee.toFixed(4) : "-"}
                    </span>
                </div>
            </div>

            {/* ACTIONS */}
            {!isConnected ? (
                <ConnectButton />
            ) : (
                <>
                    {/* OPEN POSITION */}
                    <button
                        onClick={handleTrade}
                        disabled={!canTrade}
                        className={`w-full py-3 rounded font-semibold ${canTrade ? "bg-blue-600" : "bg-gray-600"
                            }`}
                    >
                        {loading
                            ? "Executing..."
                            : `Place ${activeTab.toUpperCase()} Order`}
                    </button>

                    {/* CLOSE POSITION */}
                    <button
                        onClick={handleClose}
                        disabled={closing}
                        className="w-full mt-2 bg-red-600 py-3 rounded font-semibold"
                    >
                        {closing ? "Closing..." : "Close Position"}
                    </button>
                </>
            )}
        </div>
    );
};

export default TradePanel;