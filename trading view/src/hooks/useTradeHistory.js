import { useEffect, useState, useCallback } from "react";
import { BASE_URL } from "../config/base";

export function useTradeHistory(address) {
    const [fills,    setFills]    = useState([]);
    const [loading,  setLoading]  = useState(false);
    const [error,    setError]    = useState(null);
    const [page,     setPage]     = useState(1);
    const [filter,   setFilter]   = useState("all"); // all | long | short | open | close
    const [range,    setRange]    = useState("30d");  // 7d | 30d | 90d | all

    const PER_PAGE = 20;

    const rangeMs = {
        "7d":  7  * 24 * 60 * 60 * 1000,
        "30d": 30 * 24 * 60 * 60 * 1000,
        "90d": 90 * 24 * 60 * 60 * 1000,
        "all": 365 * 24 * 60 * 60 * 1000,
    };

    const fetch = useCallback(async () => {
        if (!address) { setFills([]); return; }
        setLoading(true);
        setError(null);
        try {
            const endTime   = Date.now();
            const startTime = endTime - (rangeMs[range] || rangeMs["30d"]);
            const res  = await window.fetch(
                `${BASE_URL}/history/trades/${address}?startTime=${startTime}&endTime=${endTime}`
            );
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "Failed");
            setFills(data.fills || []);
            setPage(1);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [address, range]);

    useEffect(() => { fetch(); }, [fetch]);

    const filtered = fills.filter(f => {
        if (filter === "all")   return true;
        if (filter === "long")  return f.dir?.toLowerCase().includes("long");
        if (filter === "short") return f.dir?.toLowerCase().includes("short");
        if (filter === "open")  return f.dir?.toLowerCase().includes("open");
        if (filter === "close") return f.dir?.toLowerCase().includes("close");
        return true;
    });

    const totalPages = Math.ceil(filtered.length / PER_PAGE);
    const paged      = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    return {
        fills: paged,
        allFills: filtered,
        loading,
        error,
        page,
        setPage,
        totalPages,
        filter,
        setFilter,
        range,
        setRange,
        refresh: fetch,
        total: filtered.length,
    };
}
