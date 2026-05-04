import React from "react";
import { useAccount } from "wagmi";
import { useOpenOrders } from "../hooks/useOpenOrders";

const formatPrice = (value) => {
    const num = Number(value || 0);

    if (!num) return "-";

    return num.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const OpenOrders = () => {
    const { address, isConnected } = useAccount();
    const { orders, loading, error } = useOpenOrders(address);

    if (!isConnected) {
        return (
            <div className="bg-[#0b1220] text-white p-4 border border-[#1e293b] shadow-xl mt-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-2">
                    Open Orders
                </h3>

                <p className="text-xs text-gray-500">
                    Connect wallet to view open orders.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-[#0b1220] text-white p-4 border border-[#1e293b] shadow-xl mt-4">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-300">
                    Open Orders / TP-SL
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

            {!loading && orders.length === 0 && (
                <div className="text-xs text-gray-500">
                    No open trigger orders
                </div>
            )}

            <div className="space-y-3">
                {orders.map((order, index) => {
                    const isReduceOnly = order.reduceOnly;
                    const isTrigger = Boolean(order.triggerPrice);

                    return (
                        <div
                            key={order.oid || index}
                            className="bg-[#111827] border border-[#1f2937] rounded-xl p-3 text-xs"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="font-semibold text-white">
                                    {order.coin || "-"}
                                </div>

                                <span
                                    className={`px-2 py-1 rounded text-[10px] font-semibold ${isTrigger
                                            ? "bg-purple-500 text-white"
                                            : "bg-blue-500 text-white"
                                        }`}
                                >
                                    {isTrigger ? "Trigger" : "Limit"}
                                </span>
                            </div>

                            <div className="space-y-1 text-gray-400">
                                <div className="flex justify-between">
                                    <span>Side</span>
                                    <span className="text-white">
                                        {order.side || "-"}
                                    </span>
                                </div>

                                <div className="flex justify-between">
                                    <span>Size</span>
                                    <span className="text-white">
                                        {order.size || "-"} {order.coin}
                                    </span>
                                </div>

                                <div className="flex justify-between">
                                    <span>Trigger Price</span>
                                    <span className="text-purple-400">
                                        ${formatPrice(order.triggerPrice)}
                                    </span>
                                </div>

                                <div className="flex justify-between">
                                    <span>Limit Price</span>
                                    <span className="text-white">
                                        ${formatPrice(order.limitPrice)}
                                    </span>
                                </div>

                                <div className="flex justify-between">
                                    <span>Condition</span>
                                    <span className="text-gray-300 text-right max-w-[180px]">
                                        {order.triggerCondition || "-"}
                                    </span>
                                </div>

                                <div className="flex justify-between">
                                    <span>Reduce Only</span>
                                    <span
                                        className={
                                            isReduceOnly
                                                ? "text-green-400"
                                                : "text-gray-400"
                                        }
                                    >
                                        {isReduceOnly ? "Yes" : "No"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default OpenOrders;