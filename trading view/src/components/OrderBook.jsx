import { useMemo, useState } from "react";
import { useLiveOrderBook } from "../hooks/useLiveOrderBook";
import "./OrderBook.css";

const fmtPrice = (value) => {
    const num = Number(value || 0);

    if (!num) return "—";

    if (num >= 1000) {
        return num.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    }

    if (num >= 1) return num.toFixed(4);

    return num.toFixed(6);
};

const fmtSize = (value) => {
    const num = Number(value || 0);

    if (!num) return "—";

    if (num >= 1000000) {
        return num.toLocaleString(undefined, {
            maximumFractionDigits: 0,
        });
    }

    if (num >= 1000) {
        return num.toLocaleString(undefined, {
            maximumFractionDigits: 2,
        });
    }

    if (num >= 1) return num.toFixed(5);

    return num.toFixed(6);
};

function buildRows(levels, unit) {
    let cumulativeCoin = 0;
    let cumulativeUsd = 0;

    return (levels || []).map((level) => {
        const price = Number(level.price || level.px || 0);
        const size = Number(level.size || level.sz || 0);
        const usdValue = price * size;

        cumulativeCoin += size;
        cumulativeUsd += usdValue;

        return {
            ...level,
            price,
            size,
            usdValue,
            cumulativeCoin,
            cumulativeUsd,
            displaySize: unit === "coin" ? size : usdValue,
            displayTotal: unit === "coin" ? cumulativeCoin : cumulativeUsd,
        };
    });
}

function addDepthPercent(rows) {
    const maxTotal = Math.max(
        ...rows.map((row) => Number(row.displayTotal || 0)),
        0
    );

    if (!maxTotal) {
        return rows.map((row) => ({
            ...row,
            depthPercent: 0,
        }));
    }

    return rows.map((row) => ({
        ...row,
        depthPercent: Math.min(
            100,
            (Number(row.displayTotal || 0) / maxTotal) * 100
        ),
    }));
}

export default function OrderBook({ coin = "BTC" }) {
    const { bids, asks, loading, error, status } = useLiveOrderBook(coin);

    const [unit, setUnit] = useState("coin");

    const processedAsks = useMemo(() => {
        return buildRows(asks, unit);
    }, [asks, unit]);

    const processedBids = useMemo(() => {
        return buildRows(bids, unit);
    }, [bids, unit]);

    const topAsks = useMemo(() => {
        const rows = [...processedAsks].slice(0, 10).reverse();
        return addDepthPercent(rows);
    }, [processedAsks]);

    const topBids = useMemo(() => {
        const rows = [...processedBids].slice(0, 10);
        return addDepthPercent(rows);
    }, [processedBids]);

    const bestAsk = asks?.[0]?.price || asks?.[0]?.px;
    const bestBid = bids?.[0]?.price || bids?.[0]?.px;

    const spread =
        bestAsk && bestBid ? Number(bestAsk) - Number(bestBid) : 0;

    const spreadPct =
        bestAsk && bestBid ? (spread / Number(bestAsk)) * 100 : 0;

    const sizeHeader = unit === "coin" ? `Size (${coin})` : "Size (USDC)";
    const totalHeader = unit === "coin" ? `Total (${coin})` : "Total (USDC)";

    return (
        <div className="orderbook-panel glass">
            <div className="ob-header">
                <div>
                    <span className="ob-title">Order Book</span>
                    <span className="ob-market">{coin}/USDC</span>
                </div>

                <div className="ob-actions">
                    <span className={`ob-live ${status}`}>
                        {status === "connected"
                            ? "Live"
                            : status === "reconnecting"
                                ? "Reconnecting"
                                : status === "connecting"
                                    ? "Connecting"
                                    : "Offline"}
                    </span>

                    <div className="ob-unit-select">
                        <select
                            value={unit}
                            onChange={(e) => setUnit(e.target.value)}
                            aria-label="Orderbook size unit"
                        >
                            <option value="coin">{coin}</option>
                            <option value="usdc">USDC</option>
                        </select>
                    </div>
                </div>
            </div>

            {error && <div className="ob-error">{error}</div>}

            <div className="ob-table-head">
                <span>Price</span>
                <span>{sizeHeader}</span>
                <span>{totalHeader}</span>
            </div>

            <div className="ob-list asks">
                {topAsks.map((ask, index) => (
                    <div
                        className="ob-row ask"
                        key={`ask-${ask.price}-${index}`}
                        style={{
                            "--depth": `${ask.depthPercent}%`,
                        }}
                    >
                        <span className="num ob-price">{fmtPrice(ask.price)}</span>
                        <span className="num">{fmtSize(ask.displaySize)}</span>
                        <span className="num">{fmtSize(ask.displayTotal)}</span>
                    </div>
                ))}
            </div>

            <div className="ob-spread">
                <span>Spread</span>

                <strong className="num">
                    {spread ? fmtPrice(spread) : "—"}
                </strong>

                <span className="num">
                    {spreadPct ? `${spreadPct.toFixed(4)}%` : "—"}
                </span>
            </div>

            <div className="ob-list bids">
                {topBids.map((bid, index) => (
                    <div
                        className="ob-row bid"
                        key={`bid-${bid.price}-${index}`}
                        style={{
                            "--depth": `${bid.depthPercent}%`,
                        }}
                    >
                        <span className="num ob-price">{fmtPrice(bid.price)}</span>
                        <span className="num">{fmtSize(bid.displaySize)}</span>
                        <span className="num">{fmtSize(bid.displayTotal)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}