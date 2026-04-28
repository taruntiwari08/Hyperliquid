import React, { useState } from "react";
import { useAccount } from "wagmi";
import { usePositions } from "../hooks/usePositions";
import { closePosition } from "../services/closeService";

const formatUsd = (value) => {
    const num = Number(value || 0);
    return num.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const Positions = () => {
    const { address, isConnected } = useAccount();
    const { positions, loading, error } = usePositions(address);

    const [closingCoin, setClosingCoin] = useState(null);

    const handleClose = async (coin) => {
        try {
            setClosingCoin(coin);

            const res = await closePosition(coin);

            console.log("CLOSE RESULT:", res);

            if (res?.error) {
                alert("❌ Close failed: " + res.error);
            } else {
                alert("✅ Position closed");
            }
        } catch (err) {
            console.error("Close position error:", err);
            alert("❌ Close error");
        } finally {
            setClosingCoin(null);
        }
    };

    if (!isConnected) {
        return (
            <div className="bg-[#0b1220] text-white p-4 border border-[#1e293b] shadow-xl mt-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-2">
                    Positions
                </h3>
                <p className="text-xs text-gray-500">
                    Connect wallet to view positions.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-[#0b1220] text-white p-4 border border-[#1e293b] shadow-xl mt-4">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-300">
                    Open Positions
                </h3>

                {loading && (
                    <span className="text-xs text-gray-500">
                        Updating...
                    </span>
                )}
            </div>

            {error && (
                <div className="text-xs text-red-400 mb-3">
                    {error}
                </div>
            )}

            {!loading && positions.length === 0 && (
                <div className="text-xs text-gray-500">
                    No open positions
                </div>
            )}

            <div className="space-y-3">
                {positions.map((pos) => {
                    const pnlPositive = Number(pos.pnl) >= 0;

                    return (
                        <div
                            key={pos.coin}
                            className="bg-[#111827] border border-[#1f2937] rounded-xl p-3 text-xs"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="font-semibold text-white">
                                    {pos.coin}
                                </div>

                                <span
                                    className={`px-2 py-1 rounded text-[10px] font-semibold ${pos.isLong
                                            ? "bg-green-500 text-black"
                                            : "bg-red-500 text-black"
                                        }`}
                                >
                                    {pos.side}
                                </span>
                            </div>

                            <div className="space-y-1 text-gray-400">
                                <div className="flex justify-between">
                                    <span>Size</span>
                                    <span className="text-white">
                                        {pos.absSize}
                                    </span>
                                </div>

                                <div className="flex justify-between">
                                    <span>Entry Price</span>
                                    <span className="text-white">
                                        ${formatUsd(pos.entryPrice)}
                                    </span>
                                </div>

                                <div className="flex justify-between">
                                    <span>Mark Price</span>
                                    <span className="text-white">
                                        ${formatUsd(pos.markPrice)}
                                    </span>
                                </div>

                                <div className="flex justify-between">
                                    <span>Unrealized PnL</span>
                                    <span
                                        className={
                                            pnlPositive
                                                ? "text-green-400"
                                                : "text-red-400"
                                        }
                                    >
                                        ${formatUsd(pos.pnl)} (
                                        {pos.pnlPercent.toFixed(2)}%)
                                    </span>
                                </div>
                            </div>

                            <button
                                onClick={() => handleClose(pos.coin)}
                                disabled={closingCoin === pos.coin}
                                className="w-full mt-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 py-2 rounded font-semibold"
                            >
                                {closingCoin === pos.coin
                                    ? "Closing..."
                                    : "Close Position"}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Positions;