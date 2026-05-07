import { useEffect, useRef, useState } from "react";

const IS_TESTNET = true;

const HL_WS_URL = IS_TESTNET
    ? "wss://api.hyperliquid-testnet.xyz/ws"
    : "wss://api.hyperliquid.xyz/ws";

function normalizeBook(data) {
    const levels = data?.levels || [];

    const bids = (levels[0] || []).map((level) => ({
        price: level.px,
        size: level.sz,
        n: level.n,
        total: Number(level.px || 0) * Number(level.sz || 0),
    }));

    const asks = (levels[1] || []).map((level) => ({
        price: level.px,
        size: level.sz,
        n: level.n,
        total: Number(level.px || 0) * Number(level.sz || 0),
    }));

    return {
        bids,
        asks,
        time: data?.time || Date.now(),
    };
}

export function useLiveOrderBook(coin) {
    const [bids, setBids] = useState([]);
    const [asks, setAsks] = useState([]);
    const [time, setTime] = useState(null);
    const [status, setStatus] = useState("idle");
    const [error, setError] = useState(null);

    const wsRef = useRef(null);
    const reconnectTimerRef = useRef(null);
    const reconnectAttemptRef = useRef(0);
    const shouldReconnectRef = useRef(true);
    const activeCoinRef = useRef(null);

    useEffect(() => {
        if (!coin) {
            setBids([]);
            setAsks([]);
            setStatus("idle");
            return;
        }

        activeCoinRef.current = coin;
        shouldReconnectRef.current = true;
        reconnectAttemptRef.current = 0;

        setBids([]);
        setAsks([]);
        setTime(null);

        const clearReconnectTimer = () => {
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
        };

        const closeSocket = () => {
            if (wsRef.current) {
                const socket = wsRef.current;
                wsRef.current = null;

                try {
                    socket.onopen = null;
                    socket.onmessage = null;
                    socket.onerror = null;
                    socket.onclose = null;
                    socket.close();
                } catch {
                    // ignore
                }
            }
        };

        const connect = () => {
            clearReconnectTimer();
            closeSocket();

            if (!shouldReconnectRef.current) return;

            setStatus((prev) => {
                return prev === "connected" ? "connected" : "connecting";
            });

            setError(null);

            const ws = new WebSocket(HL_WS_URL);
            wsRef.current = ws;

            ws.onopen = () => {
                if (activeCoinRef.current !== coin) return;

                reconnectAttemptRef.current = 0;
                setStatus("connected");

                ws.send(
                    JSON.stringify({
                        method: "subscribe",
                        subscription: {
                            type: "l2Book",
                            coin,
                        },
                    })
                );
            };

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);

                    if (msg.channel === "subscriptionResponse") return;
                    if (msg.channel === "pong") return;
                    if (msg.channel !== "l2Book") return;

                    const bookData = msg.data;

                    if (bookData?.coin && bookData.coin !== activeCoinRef.current) {
                        return;
                    }

                    const normalized = normalizeBook(bookData);

                    setBids(normalized.bids);
                    setAsks(normalized.asks);
                    setTime(normalized.time);
                    setStatus("connected");
                } catch (err) {
                    console.error("Orderbook WS parse error:", err);
                }
            };

            ws.onerror = () => {
                if (!shouldReconnectRef.current) return;

                setError("Orderbook websocket error");
            };

            ws.onclose = () => {
                if (!shouldReconnectRef.current) return;

                setStatus("reconnecting");

                const attempt = reconnectAttemptRef.current + 1;
                reconnectAttemptRef.current = attempt;

                const delay = Math.min(500 * attempt, 4000);

                reconnectTimerRef.current = setTimeout(() => {
                    connect();
                }, delay);
            };
        };

        connect();

        return () => {
            shouldReconnectRef.current = false;
            clearReconnectTimer();
            closeSocket();
        };
    }, [coin]);

    return {
        bids,
        asks,
        time,
        status,
        error,
        loading: status === "connecting" || status === "reconnecting",
    };
}