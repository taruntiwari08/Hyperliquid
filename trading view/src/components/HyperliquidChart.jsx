import { useEffect, useMemo, useRef, useState } from "react";
import {
    CandlestickSeries,
    createChart,
} from "lightweight-charts";

import { useCandles } from "../hooks/useCandles";
import "./HyperliquidChart.css";

const INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d"];

function formatPrice(value) {
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
}

function normalizeCandles(candles) {
    const map = new Map();

    for (const candle of candles || []) {
        if (
            !candle?.time ||
            !Number.isFinite(candle.open) ||
            !Number.isFinite(candle.high) ||
            !Number.isFinite(candle.low) ||
            !Number.isFinite(candle.close)
        ) {
            continue;
        }

        map.set(candle.time, {
            time: candle.time,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
        });
    }

    return Array.from(map.values()).sort((a, b) => a.time - b.time);
}

export default function HyperliquidChart({ coin = "BTC" }) {
    const chartRef = useRef(null);
    const chartInstanceRef = useRef(null);
    const candleSeriesRef = useRef(null);

    const [interval, setIntervalValue] = useState("15m");

    const { candles, loading, error } = useCandles(coin, interval);

    const chartCandles = useMemo(() => {
        return normalizeCandles(candles);
    }, [candles]);

    const latestPrice = useMemo(() => {
        if (!chartCandles.length) return null;
        return chartCandles[chartCandles.length - 1]?.close;
    }, [chartCandles]);

    useEffect(() => {
        if (!chartRef.current) return;

        const chart = createChart(chartRef.current, {
            autoSize: true,

            layout: {
                background: {
                    color: "#04080f",
                },
                textColor: "#94a3b8",
                fontSize: 12,
            },

            grid: {
                vertLines: {
                    color: "rgba(148, 163, 184, 0.06)",
                },
                horzLines: {
                    color: "rgba(148, 163, 184, 0.06)",
                },
            },

            rightPriceScale: {
                borderColor: "rgba(148, 163, 184, 0.12)",
                scaleMargins: {
                    top: 0.12,
                    bottom: 0.12,
                },
            },

            timeScale: {
                borderColor: "rgba(148, 163, 184, 0.12)",
                timeVisible: true,
                secondsVisible: false,

                // Important for readable latest candles
                rightOffset: 12,
                barSpacing: 10,
                minBarSpacing: 6,

                fixLeftEdge: false,
                fixRightEdge: false,
                lockVisibleTimeRangeOnResize: true,
                rightBarStaysOnScroll: true,
            },

            crosshair: {
                mode: 1,
                vertLine: {
                    color: "rgba(148, 163, 184, 0.35)",
                    width: 1,
                    style: 3,
                    labelBackgroundColor: "#0f172a",
                },
                horzLine: {
                    color: "rgba(148, 163, 184, 0.35)",
                    width: 1,
                    style: 3,
                    labelBackgroundColor: "#0f172a",
                },
            },

            localization: {
                priceFormatter: (price) => formatPrice(price),
            },
        });

        const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: "#00c896",
            downColor: "#ff4d6d",
            borderUpColor: "#00c896",
            borderDownColor: "#ff4d6d",
            wickUpColor: "#00c896",
            wickDownColor: "#ff4d6d",

            priceLineVisible: true,
            lastValueVisible: true,
            priceLineColor: "#4dd0c1",
            priceLineWidth: 1,
        });

        chartInstanceRef.current = chart;
        candleSeriesRef.current = candleSeries;

        const resizeObserver = new ResizeObserver(() => {
            if (!chartRef.current || !chartInstanceRef.current) return;

            chartInstanceRef.current.applyOptions({
                width: chartRef.current.clientWidth,
                height: chartRef.current.clientHeight,
            });

            // Keep latest candles visible after resize
            if (chartCandles.length > 0) {
                const timeScale = chartInstanceRef.current.timeScale();

                setTimeout(() => {
                    timeScale.scrollToRealTime();
                }, 30);
            }
        });

        resizeObserver.observe(chartRef.current);

        return () => {
            resizeObserver.disconnect();
            chart.remove();
            chartInstanceRef.current = null;
            candleSeriesRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (!candleSeriesRef.current || !chartInstanceRef.current) return;

        candleSeriesRef.current.setData(chartCandles);

        if (chartCandles.length > 0) {
            const chart = chartInstanceRef.current;
            const timeScale = chart.timeScale();

            const visibleCount = Math.min(80, chartCandles.length);
            const lastIndex = chartCandles.length - 1;

            // Show latest candles by default
            timeScale.setVisibleLogicalRange({
                from: Math.max(0, lastIndex - visibleCount),
                to: lastIndex + 12,
            });

            // Force latest/right side visible after data loads
            setTimeout(() => {
                timeScale.scrollToRealTime();
            }, 50);
        }
    }, [chartCandles, coin, interval]);

    return (
        <div className="hl-chart-shell glass">
            <div className="hl-chart-header">
                <div className="hl-chart-left">
                    <div className="hl-chart-title">
                        {coin}/USDC Perpetual
                    </div>

                    <div className="hl-chart-price">
                        {latestPrice ? `$${formatPrice(latestPrice)}` : "—"}
                    </div>
                </div>

                <div className="hl-chart-actions">
                    {INTERVALS.map((item) => (
                        <button
                            key={item}
                            type="button"
                            className={interval === item ? "active" : ""}
                            onClick={() => setIntervalValue(item)}
                        >
                            {item}
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div className="hl-chart-error">
                    {error}
                </div>
            )}

            {loading && (
                <div className="hl-chart-loading">
                    Loading candles...
                </div>
            )}

            {!loading && chartCandles.length === 0 && (
                <div className="hl-chart-empty">
                    No candle data available for {coin}
                </div>
            )}

            <div ref={chartRef} className="hl-chart-container" />
        </div>
    );
}