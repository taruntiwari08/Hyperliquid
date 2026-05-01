import React, { useState, useEffect } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";

import { usePrices } from "../hooks/usePrices";
import { useBalance } from "../hooks/useBalance";

import { placeTrade } from "../services/tradeService";
import {
    createOrGetAgent,
    approveAgent,
    markAgentApproved,
} from "../services/agentService";

import { approveBuilderFee } from "../services/builderService";

const TradePanel = () => {
    const { isConnected, address } = useAccount();

    const prices = usePrices();
    const balance = useBalance(address);

    const [activeTab, setActiveTab] = useState("long");
    const [orderType, setOrderType] = useState("market");

    const [leverage, setLeverage] = useState(5);
    const [size, setSize] = useState("");
    const [coin, setCoin] = useState("BTC");

    const [loading, setLoading] = useState(false);

    const [agentLoading, setAgentLoading] = useState(false);
    const [approvingAgent, setApprovingAgent] = useState(false);
    const [agentApproved, setAgentApproved] = useState(false);
    const [agentData, setAgentData] = useState(null);

    const [approvingBuilder, setApprovingBuilder] = useState(false);
    const [builderApproved, setBuilderApproved] = useState(false);

    const BUILDER_ADDRESS = "0xB7c94Ac7C1C16744E9f3cDDEC09F54920D2C39B8";

    // Backend f: 100 = 0.1%
    const BUILDER_FEE_RATE = "0.1%";
    const BUILDER_APPROVAL_VERSION = "v1";
    const builderFeeRateDecimal = 0.001;

    const builderApprovalKey = address
        ? `builderApproved_${address}_${BUILDER_ADDRESS}_${BUILDER_FEE_RATE}_${BUILDER_APPROVAL_VERSION}`
        : null;

    // =====================================
    // LOAD / CREATE USER-SPECIFIC AGENT
    // =====================================
    useEffect(() => {
        const setupAgent = async () => {
            try {
                if (!address) {
                    setAgentData(null);
                    setAgentApproved(false);
                    setBuilderApproved(false);
                    return;
                }

                setAgentLoading(true);

                const agent = await createOrGetAgent(address);

                setAgentData(agent);
                setAgentApproved(Boolean(agent?.isApproved));

                const savedBuilder = builderApprovalKey
                    ? localStorage.getItem(builderApprovalKey)
                    : null;

                setBuilderApproved(savedBuilder === "true");
            } catch (err) {
                console.error("Agent setup error:", err);
                setAgentData(null);
                setAgentApproved(false);
            } finally {
                setAgentLoading(false);
            }
        };

        setupAgent();
    }, [address, builderApprovalKey]);

    const currentPrice = Number(prices?.[coin] || 0);
    const coinSize = Number(size || 0);
    const numericBalance = Number(balance || 0);
    const numericLeverage = Number(leverage || 1);

    const positionValue = coinSize * currentPrice;
    const marginUsed = positionValue / numericLeverage;

    const estimatedLiquidation =
        currentPrice && numericLeverage
            ? activeTab === "long"
                ? currentPrice * (1 - 1 / numericLeverage)
                : currentPrice * (1 + 1 / numericLeverage)
            : 0;

    const estimatedExchangeFeeRate = 0.00045;
    const estimatedExchangeFee = positionValue * estimatedExchangeFeeRate;
    const estimatedBuilderFee = positionValue * builderFeeRateDecimal;

    const canTrade =
        agentApproved &&
        builderApproved &&
        coinSize > 0 &&
        marginUsed > 0 &&
        marginUsed <= numericBalance &&
        !loading;

    const resetBuilderApproval = () => {
        setBuilderApproved(false);

        if (builderApprovalKey) {
            localStorage.removeItem(builderApprovalKey);
        }
    };

    // =====================================
    // APPROVE USER-SPECIFIC AGENT
    // =====================================
    const handleApproveAgent = async () => {
        try {
            if (!address) {
                alert("Connect wallet first");
                return;
            }

            if (!agentData?.agentAddress || !agentData?.agentName) {
                alert("Agent not ready yet");
                return;
            }

            setApprovingAgent(true);

            await approveAgent(agentData.agentAddress, agentData.agentName);

            await markAgentApproved(address);

            setAgentApproved(true);

            alert("✅ Agent approved");
        } catch (err) {
            console.error("Approve agent error:", err);
            alert("❌ Agent approval failed");
        } finally {
            setApprovingAgent(false);
        }
    };

    // =====================================
    // APPROVE BUILDER FEE
    // =====================================
    const handleApproveBuilderFee = async () => {
        try {
            if (!address) {
                alert("Connect wallet first");
                return;
            }

            if (!BUILDER_ADDRESS || BUILDER_ADDRESS === "0xYOUR_BUILDER_ADDRESS") {
                alert("Set builder address first");
                return;
            }

            setApprovingBuilder(true);

            await approveBuilderFee(BUILDER_ADDRESS, BUILDER_FEE_RATE);

            setBuilderApproved(true);

            if (builderApprovalKey) {
                localStorage.setItem(builderApprovalKey, "true");
            }

            alert(`✅ Builder fee approved (${BUILDER_FEE_RATE})`);
        } catch (err) {
            console.error("Builder approval error:", err);
            alert("❌ Builder fee approval failed");
        } finally {
            setApprovingBuilder(false);
        }
    };

    // =====================================
    // EXECUTE TRADE
    // =====================================
    const handleTrade = async () => {
        try {
            if (!address) {
                alert("Connect wallet first");
                return;
            }

            if (!agentApproved) {
                alert("⚠️ Please approve agent first");
                return;
            }

            if (!builderApproved) {
                alert(`⚠️ Please approve builder fee first (${BUILDER_FEE_RATE})`);
                return;
            }

            if (!coinSize || coinSize <= 0) {
                alert(`Enter valid ${coin} size`);
                return;
            }

            if (marginUsed > numericBalance) {
                alert("❌ Insufficient balance");
                return;
            }

            setLoading(true);

            const res = await placeTrade({
                userAddress: address,
                coin,
                isLong: activeTab === "long",
                size: coinSize,
                leverage: numericLeverage,
            });

            if (res?.error) {
                if (
                    res.error.includes("Builder fee has not been approved") ||
                    res.error.includes("builder fee") ||
                    res.error.includes("Builder")
                ) {
                    resetBuilderApproval();
                    alert(`⚠️ Builder fee approval required again for ${BUILDER_FEE_RATE}`);
                    return;
                }

                if (
                    res.error.includes("Agent not approved") ||
                    res.error.includes("Agent not created") ||
                    res.error.includes("API Wallet")
                ) {
                    setAgentApproved(false);
                    alert("⚠️ Agent approval required again");
                    return;
                }

                alert("❌ " + res.error);
            } else {
                alert("✅ Trade executed");
            }
        } catch (err) {
            console.error("Trade error:", err);
            alert("❌ Trade error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full bg-[#0b1220] text-white p-4 border border-[#1e293b] shadow-xl">
            <div className="text-xs text-gray-400 mb-2">
                {coin} Price: ${prices?.[coin] || "loading..."}
            </div>

            <div className="text-xs text-gray-400 mb-2">
                Available to Trade: ${balance || "0"} USDC
            </div>

            {isConnected && (
                <>
                    <button
                        onClick={handleApproveAgent}
                        disabled={agentLoading || approvingAgent || agentApproved}
                        className="w-full bg-yellow-500 text-black py-2 rounded mb-3 font-semibold"
                    >
                        {agentLoading
                            ? "Preparing Agent..."
                            : agentApproved
                                ? "Agent Approved ✅"
                                : approvingAgent
                                    ? "Approving Agent..."
                                    : "Approve Agent"}
                    </button>

                    {agentData?.agentAddress && (
                        <div className="text-[10px] text-gray-500 mb-3 break-all">
                            Agent: {agentData.agentAddress}
                        </div>
                    )}

                    <button
                        onClick={handleApproveBuilderFee}
                        disabled={approvingBuilder || builderApproved}
                        className="w-full bg-purple-500 text-white py-2 rounded mb-3 font-semibold"
                    >
                        {builderApproved
                            ? `Builder Fee Approved (${BUILDER_FEE_RATE}) ✅`
                            : approvingBuilder
                                ? "Approving Builder..."
                                : `Approve Builder Fee (${BUILDER_FEE_RATE})`}
                    </button>
                </>
            )}

            <div className="flex gap-2 mb-4">
                <select
                    value={leverage}
                    onChange={(e) => setLeverage(Number(e.target.value))}
                    className="bg-[#111827] px-3 py-2 rounded-lg text-sm w-1/3"
                >
                    <option value={2}>2x</option>
                    <option value={5}>5x</option>
                    <option value={10}>10x</option>
                    <option value={20}>20x</option>
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

            <div className="flex bg-[#111827] rounded-xl overflow-hidden mb-4">
                <button
                    onClick={() => setActiveTab("long")}
                    className={`flex-1 py-2 ${activeTab === "long"
                            ? "bg-green-500 text-black"
                            : "text-gray-400"
                        }`}
                >
                    Buy / Long
                </button>

                <button
                    onClick={() => setActiveTab("short")}
                    className={`flex-1 py-2 ${activeTab === "short"
                            ? "bg-red-500 text-black"
                            : "text-gray-400"
                        }`}
                >
                    Sell / Short
                </button>
            </div>

            <div className="flex gap-4 mb-4 text-sm">
                {["market", "limit"].map((type) => (
                    <button
                        key={type}
                        onClick={() => setOrderType(type)}
                        className={`${orderType === type
                                ? "text-blue-400"
                                : "text-gray-500"
                            }`}
                    >
                        {type}
                    </button>
                ))}
            </div>

            <input
                type="number"
                placeholder={`Size (${coin})`}
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="w-full p-2 bg-[#111827] rounded mb-3"
            />

            <div className="bg-[#111827] rounded mb-3 p-3 text-xs text-gray-400 space-y-2">
                <div className="flex justify-between">
                    <span>Entry Price</span>
                    <span className="text-white">
                        ${currentPrice ? currentPrice.toFixed(2) : "-"}
                    </span>
                </div>

                <div className="flex justify-between">
                    <span>Size</span>
                    <span className="text-white">
                        {coinSize ? coinSize : "-"} {coin}
                    </span>
                </div>

                <div className="flex justify-between">
                    <span>Position Value</span>
                    <span className="text-white">
                        ${positionValue ? positionValue.toFixed(2) : "-"}
                    </span>
                </div>

                <div className="flex justify-between">
                    <span>Margin Used</span>
                    <span className="text-white">
                        ${marginUsed ? marginUsed.toFixed(2) : "-"}
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
                    <span>Est. Exchange Fee</span>
                    <span className="text-yellow-400">
                        ${estimatedExchangeFee ? estimatedExchangeFee.toFixed(4) : "-"}
                    </span>
                </div>

                <div className="flex justify-between">
                    <span>Est. Builder Fee ({BUILDER_FEE_RATE})</span>
                    <span className="text-purple-400">
                        ${estimatedBuilderFee ? estimatedBuilderFee.toFixed(4) : "-"}
                    </span>
                </div>
            </div>

            {!isConnected ? (
                <ConnectButton />
            ) : (
                <button
                    onClick={handleTrade}
                    disabled={!canTrade}
                    className={`w-full py-3 rounded font-semibold ${canTrade ? "bg-blue-600" : "bg-gray-600"
                        }`}
                >
                    {loading
                        ? "Executing..."
                        : `Place ${activeTab === "long" ? "LONG" : "SHORT"} Order`}
                </button>
            )}
        </div>
    );
};

export default TradePanel;