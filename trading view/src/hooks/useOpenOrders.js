import { useEffect, useState } from "react";
import { BASE_URL } from "../config/base";

export function useOpenOrders(address) {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!address) {
            setOrders([]);
            return;
        }

        let isMounted = true;

        const fetchOpenOrders = async () => {
            try {
                setLoading(true);

                const res = await fetch(`${BASE_URL}/open-orders/${address}`);
                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data?.error || "Failed to fetch open orders");
                }

                const normalizedOrders = (data.orders || []).map((order) => {
                    const triggerPrice =
                        order.triggerPx ||
                        order.trigger?.triggerPx ||
                        order.triggerPrice ||
                        null;

                    const limitPrice =
                        order.limitPx ||
                        order.px ||
                        order.price ||
                        null;

                    const isTrigger =
                        Boolean(triggerPrice) ||
                        Boolean(order.triggerCondition) ||
                        Boolean(order.isTrigger);

                    return {
                        coin: order.coin,
                        side: order.side || (order.isBuy ? "Buy" : "Sell"),
                        size: order.sz || order.size || "0",
                        limitPrice,
                        triggerPrice,
                        triggerCondition:
                            order.triggerCondition ||
                            order.orderType ||
                            (isTrigger ? "Trigger order" : "Limit order"),
                        reduceOnly: Boolean(order.reduceOnly || order.r),
                        oid: order.oid,
                        timestamp: order.timestamp || order.time,
                        raw: order,
                    };
                });

                if (isMounted) {
                    setOrders(normalizedOrders);
                    setError(null);
                }
            } catch (err) {
                console.error("Open orders error:", err);

                if (isMounted) {
                    setError(err.message || "Failed to fetch open orders");
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchOpenOrders();

        const interval = setInterval(fetchOpenOrders, 3000);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [address]);

    return { orders, loading, error };
}