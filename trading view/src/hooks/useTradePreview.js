import { useEffect, useState } from "react";
import { getTradePreview } from "../services/previewService";

export function useTradePreview({
    address,
    coin,
    side,
    margin,
    leverage,
    enabled,
}) {
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (
            !enabled ||
            !address ||
            !coin ||
            !margin ||
            Number(margin) <= 0 ||
            !leverage
        ) {
            setPreview(null);
            setError(null);
            return;
        }

        let cancelled = false;

        const timer = setTimeout(async () => {
            try {
                setLoading(true);

                const data = await getTradePreview({
                    userAddress: address,
                    coin,
                    isLong: side === "long",
                    margin: Number(margin),
                    leverage: Number(leverage),
                });

                if (cancelled) return;

                if (data?.error) {
                    setPreview(null);
                    setError(data.error);
                } else {
                    setPreview(data);
                    setError(null);
                }
            } catch (err) {
                if (!cancelled) {
                    setPreview(null);
                    setError(err.message || "Preview failed");
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }, 350);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [address, coin, side, margin, leverage, enabled]);

    return {
        preview,
        loading,
        error,
    };
}