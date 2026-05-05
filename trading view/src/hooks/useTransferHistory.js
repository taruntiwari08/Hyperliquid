import { useEffect, useState, useCallback } from "react";
import { BASE_URL } from "../config/base";

export function useTransferHistory(address) {
    const [all,        setAll]       = useState([]);
    const [loading,    setLoading]   = useState(false);
    const [error,      setError]     = useState(null);
    const [tab,        setTab]       = useState("all"); // all | deposits | withdrawals
    const [page,       setPage]      = useState(1);
    const [range,      setRange]     = useState("90d");

    const PER_PAGE = 15;

    const rangeMs = {
        "30d":  30  * 24 * 60 * 60 * 1000,
        "90d":  90  * 24 * 60 * 60 * 1000,
        "180d": 180 * 24 * 60 * 60 * 1000,
        "all":  365 * 24 * 60 * 60 * 1000,
    };

    const fetch = useCallback(async () => {
        if (!address) { setAll([]); return; }
        setLoading(true);
        setError(null);
        try {
            const endTime   = Date.now();
            const startTime = endTime - (rangeMs[range] || rangeMs["90d"]);
            const res  = await window.fetch(
                `${BASE_URL}/history/transfers/${address}?startTime=${startTime}&endTime=${endTime}`
            );
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "Failed");
            setAll(data.all || []);
            setPage(1);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [address, range]);

    useEffect(() => { fetch(); }, [fetch]);

    const filtered =
        tab === "deposits"    ? all.filter(r => r.isDeposit) :
        tab === "withdrawals" ? all.filter(r => r.isWithdrawal) :
        all;

    const totalPages = Math.ceil(filtered.length / PER_PAGE);
    const paged      = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    const totalDeposited  = all.filter(r => r.isDeposit).reduce((s, r)  => s + Number(r.amount || 0), 0);
    const totalWithdrawn  = all.filter(r => r.isWithdrawal).reduce((s, r) => s + Number(r.amount || 0), 0);

    return {
        rows: paged,
        allRows: filtered,
        loading,
        error,
        tab,
        setTab,
        page,
        setPage,
        totalPages,
        range,
        setRange,
        refresh: fetch,
        total: filtered.length,
        totalDeposited,
        totalWithdrawn,
    };
}
