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
    const [margin, setMargin] = useState("");
    const [coin, setCoin] = useState("BTC");

    const [tpSlEnabled, setTpSlEnabled] = useState(false);
    const [tpPrice, setTpPrice] = useState("");
    const [slPrice, setSlPrice] = useState("");

    const [loading, setLoading] = useState(false);

    const [agentLoading, setAgentLoading] = useState(false);
    const [approvingAgent, setApprovingAgent] = useState(false);
    const [agentApproved, setAgentApproved] = useState(false);
    const [agentData, setAgentData] = useState(null);

    const [showAgentModal, setShowAgentModal] = useState(false);

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
                setBuilderApproved(false);
            } finally {
                setAgentLoading(false);
            }
        };

        setupAgent();
    }, [address, builderApprovalKey]);

    const currentPrice = Number(prices?.[coin] || 0);
    const marginAmount = Number(margin || 0);
    const numericBalance = Number(balance || 0);
    const numericLeverage = Number(leverage || 1);

    const positionValue = marginAmount * numericLeverage;
    const coinSize = currentPrice ? positionValue / currentPrice : 0;
    const marginUsed = marginAmount;

    const estimatedLiquidation =
        currentPrice && numericLeverage
            ? activeTab === "long"
                ? currentPrice * (1 - 1 / numericLeverage)
                : currentPrice * (1 + 1 / numericLeverage)
            : 0;

    const estimatedExchangeFeeRate = 0.00045;
    const estimatedExchangeFee = positionValue * estimatedExchangeFeeRate;
    const estimatedBuilderFee = positionValue * builderFeeRateDecimal;

    const tradingEnabled = agentApproved && builderApproved;

    const canPlaceOrder =
        tradingEnabled &&
        marginAmount > 0 &&
        marginUsed <= numericBalance &&
        currentPrice > 0 &&
        !loading;

    const resetBuilderApproval = () => {
        setBuilderApproved(false);

        if (builderApprovalKey) {
            localStorage.removeItem(builderApprovalKey);
        }
    };

    const validateTpSl = () => {
        if (!tpSlEnabled) return true;

        const tp = Number(tpPrice || 0);
        const sl = Number(slPrice || 0);

        if (!tp && !sl) {
            alert("Enter Take Profit or Stop Loss price");
            return false;
        }

        if (!currentPrice) {
            alert("Price not loaded yet");
            return false;
        }

        if (activeTab === "long") {
            if (tp && tp <= currentPrice) {
                alert("For LONG, Take Profit must be above current price");
                return false;
            }

            if (sl && sl >= currentPrice) {
                alert("For LONG, Stop Loss must be below current price");
                return false;
            }
        }

        if (activeTab === "short") {
            if (tp && tp >= currentPrice) {
                alert("For SHORT, Take Profit must be below current price");
                return false;
            }

            if (sl && sl <= currentPrice) {
                alert("For SHORT, Stop Loss must be above current price");
                return false;
            }
        }

        return true;
    };

    const handleEnableTrading = async () => {
        try {
            if (!address) {
                alert("Connect wallet first");
                return;
            }

            if (!agentData?.agentAddress || !agentData?.agentName) {
                alert("Agent not ready yet");
                return;
            }

            if (!BUILDER_ADDRESS || BUILDER_ADDRESS === "0xYOUR_BUILDER_ADDRESS") {
                alert("Set builder address first");
                return;
            }

            if (!agentApproved) {
                setApprovingAgent(true);

                await approveAgent(agentData.agentAddress, agentData.agentName);

                await markAgentApproved(address);

                setAgentApproved(true);
                setApprovingAgent(false);
            }

            if (!builderApproved) {
                setApprovingBuilder(true);

                await approveBuilderFee(BUILDER_ADDRESS, BUILDER_FEE_RATE);

                setBuilderApproved(true);

                if (builderApprovalKey) {
                    localStorage.setItem(builderApprovalKey, "true");
                }

                setApprovingBuilder(false);
            }

            setShowAgentModal(false);
            alert("✅ Trading enabled successfully");
        } catch (err) {
            console.error("Enable trading error:", err);
            alert("❌ Trading enable failed");
        } finally {
            setApprovingAgent(false);
            setApprovingBuilder(false);
        }
    };

    const handleMainAction = async () => {
        if (!tradingEnabled) {
            setShowAgentModal(true);
            return;
        }

        await handleTrade();
    };

    const handleTrade = async () => {
        try {
            if (!address) {
                alert("Connect wallet first");
                return;
            }

            if (!agentApproved || !builderApproved) {
                setShowAgentModal(true);
                return;
            }

            if (!marginAmount || marginAmount <= 0) {
                alert("Enter valid margin");
                return;
            }

            if (marginUsed > numericBalance) {
                alert("❌ Insufficient balance");
                return;
            }

            if (!validateTpSl()) {
                return;
            }

            setLoading(true);

            const res = await placeTrade({
                userAddress: address,
                coin,
                isLong: activeTab === "long",
                margin: marginAmount,
                leverage: numericLeverage,
                tpPrice: tpSlEnabled && tpPrice ? Number(tpPrice) : null,
                slPrice: tpSlEnabled && slPrice ? Number(slPrice) : null,
            });

            if (res?.error) {
                if (
                    res.error.includes("Builder fee has not been approved") ||
                    res.error.includes("builder fee") ||
                    res.error.includes("Builder")
                ) {
                    resetBuilderApproval();
                    setShowAgentModal(true);
                    alert(`⚠️ Builder fee approval required again for ${BUILDER_FEE_RATE}`);
                    return;
                }

                if (
                    res.error.includes("Agent not approved") ||
                    res.error.includes("Agent not created") ||
                    res.error.includes("API Wallet")
                ) {
                    setAgentApproved(false);
                    setShowAgentModal(true);
                    alert("⚠️ Trading connection required again");
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

    const mainButtonDisabled =
        agentLoading ||
        approvingAgent ||
        approvingBuilder ||
        loading ||
        (tradingEnabled && !canPlaceOrder);

    const mainButtonText = !tradingEnabled
        ? agentLoading
            ? "Preparing..."
            : approvingAgent
                ? "Approving Agent..."
                : approvingBuilder
                    ? "Approving Builder Fee..."
                    : "Enable Trading"
        : loading
            ? "Executing..."
            : `Place ${activeTab === "long" ? "LONG" : "SHORT"} Order`;

    return (
        <>
            <div className="w-full bg-[#0b1220] text-white p-4 border border-[#1e293b] shadow-xl">
                <div className="text-xs text-gray-400 mb-2">
                    {coin} Price: ${prices?.[coin] || "loading..."}
                </div>

                <div className="text-xs text-gray-400 mb-2">
                    Available to Trade: ${balance || "0"} USDC
                </div>

                {isConnected && tradingEnabled && (
                    <div className="w-full bg-[#12352f] border border-[#2dd4bf] text-[#5eead4] py-2 rounded mb-3 font-semibold text-center text-sm">
                        Trading Enabled ✅
                    </div>
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
                    placeholder="Margin (USDC)"
                    value={margin}
                    onChange={(e) => setMargin(e.target.value)}
                    className="w-full p-2 bg-[#111827] rounded mb-3"
                />

                <div className="w-full p-2 bg-[#111827] rounded mb-3 opacity-80 text-sm text-gray-300">
                    Size: {coinSize ? coinSize.toFixed(6) : "-"} {coin}
                </div>

                <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-gray-400">TP/SL</span>

                    <button
                        type="button"
                        onClick={() => setTpSlEnabled(!tpSlEnabled)}
                        className={`w-11 h-6 rounded-full relative ${tpSlEnabled ? "bg-blue-500" : "bg-gray-600"
                            }`}
                    >
                        <span
                            className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${tpSlEnabled ? "left-6" : "left-1"
                                }`}
                        />
                    </button>
                </div>

                {tpSlEnabled && (
                    <div className="grid grid-cols-2 gap-2 mb-3">
                        <input
                            type="number"
                            placeholder="Take Profit Price"
                            value={tpPrice}
                            onChange={(e) => setTpPrice(e.target.value)}
                            className="w-full p-2 bg-[#111827] rounded text-sm"
                        />

                        <input
                            type="number"
                            placeholder="Stop Loss Price"
                            value={slPrice}
                            onChange={(e) => setSlPrice(e.target.value)}
                            className="w-full p-2 bg-[#111827] rounded text-sm"
                        />
                    </div>
                )}

                <div className="bg-[#111827] rounded mb-3 p-3 text-xs text-gray-400 space-y-2">
                    <div className="flex justify-between">
                        <span>Entry Price</span>
                        <span className="text-white">
                            ${currentPrice ? currentPrice.toFixed(2) : "-"}
                        </span>
                    </div>

                    <div className="flex justify-between">
                        <span>Margin Used</span>
                        <span className="text-white">
                            ${marginUsed ? marginUsed.toFixed(2) : "-"}
                        </span>
                    </div>

                    <div className="flex justify-between">
                        <span>Position Value</span>
                        <span className="text-white">
                            ${positionValue ? positionValue.toFixed(2) : "-"}
                        </span>
                    </div>

                    <div className="flex justify-between">
                        <span>Size</span>
                        <span className="text-white">
                            {coinSize ? coinSize.toFixed(6) : "-"} {coin}
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

                    {tpSlEnabled && (
                        <>
                            <div className="flex justify-between">
                                <span>Take Profit</span>
                                <span className="text-green-400">
                                    {tpPrice ? `$${Number(tpPrice).toFixed(2)}` : "-"}
                                </span>
                            </div>

                            <div className="flex justify-between">
                                <span>Stop Loss</span>
                                <span className="text-red-400">
                                    {slPrice ? `$${Number(slPrice).toFixed(2)}` : "-"}
                                </span>
                            </div>
                        </>
                    )}

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
                        onClick={handleMainAction}
                        disabled={mainButtonDisabled}
                        className={`w-full py-3 rounded font-semibold ${!tradingEnabled
                                ? "bg-[#4dd0c1] text-black"
                                : canPlaceOrder
                                    ? "bg-blue-600"
                                    : "bg-gray-600"
                            }`}
                    >
                        {mainButtonText}
                    </button>
                )}
            </div>

            {showAgentModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
                    <div className="relative w-full max-w-[760px] rounded-2xl border border-[#26343b] bg-[#081719] p-8 text-white shadow-2xl">
                        <button
                            onClick={() => setShowAgentModal(false)}
                            className="absolute right-6 top-6 text-gray-300 hover:text-white text-3xl"
                        >
                            ×
                        </button>

                        <div className="text-center">
                            <h2 className="text-2xl font-semibold mb-5">
                                Establish Connection
                            </h2>

                            <p className="text-gray-300 text-lg max-w-[650px] mx-auto mb-5">
                                This signature is gas-free to send. It opens a decentralized
                                channel for gas-free and instantaneous trading. After this,
                                you will approve the platform builder fee for future trades.
                            </p>

                            <div className="bg-[#0f2629] border border-[#21474d] rounded-xl p-4 mb-6 text-left text-sm text-gray-300">
                                <div className="flex justify-between mb-2">
                                    <span>Trading Agent</span>
                                    <span className={agentApproved ? "text-green-400" : "text-yellow-400"}>
                                        {agentApproved ? "Approved" : "Required"}
                                    </span>
                                </div>

                                <div className="flex justify-between">
                                    <span>Builder Fee</span>
                                    <span className={builderApproved ? "text-green-400" : "text-yellow-400"}>
                                        {builderApproved ? "Approved" : `${BUILDER_FEE_RATE} Required`}
                                    </span>
                                </div>
                            </div>

                            <button
                                onClick={handleEnableTrading}
                                disabled={approvingAgent || approvingBuilder || agentLoading}
                                className="w-full bg-[#4dd0c1] hover:bg-[#5de0d1] disabled:bg-gray-600 text-black py-4 rounded-xl text-lg font-medium"
                            >
                                {agentLoading
                                    ? "Preparing Agent..."
                                    : approvingAgent
                                        ? "Approving Agent..."
                                        : approvingBuilder
                                            ? "Approving Builder Fee..."
                                            : "Establish Connection"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default TradePanel;