import { useMemo, useState } from 'react'
import { useMarkets } from '../hooks/useMarkets'
import { usePrices } from '../hooks/usePrices'
import './MarketsModal.css'

const fmt = (n) => {
    const num = Number(n || 0)
    if (!num) return '—'
    if (num >= 1000) return num.toLocaleString(undefined, { maximumFractionDigits: 2 })
    if (num >= 1) return num.toFixed(3)
    return num.toFixed(5)
}

const normalizeCoin = (market) => {
    if (typeof market === 'string') return market

    return {
        coin: market?.coin || market?.name || market?.symbol || '',
        maxLeverage: market?.maxLeverage || market?.leverage || null,
        isPerp: market?.type ? String(market.type).toLowerCase().includes('perp') : true,
    }
}

export default function MarketsModal({
    open,
    onClose,
    onSelectCoin,
    selectedCoin,
}) {
    const [query, setQuery] = useState('')
    const { coins, loading } = useMarkets()
    const prices = usePrices()

    const markets = useMemo(() => {
        return (coins || [])
            .map(normalizeCoin)
            .filter((m) => m.coin)
            .filter((m) => m.isPerp !== false)
    }, [coins])

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()

        if (!q) return markets

        return markets.filter((m) =>
            m.coin.toLowerCase().includes(q) ||
            `${m.coin}/USDC`.toLowerCase().includes(q)
        )
    }, [markets, query])

    if (!open) return null

    return (
        <div className="markets-modal-overlay" onClick={onClose}>
            <div className="markets-modal" onClick={(e) => e.stopPropagation()}>
                <div className="markets-modal-top">
                    <div className="markets-search-wrap">
                        <input
                            type="text"
                            placeholder="Search perp markets"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="markets-search"
                        />
                    </div>

                    <button className="markets-close" onClick={onClose}>
                        ×
                    </button>
                </div>

                <div className="markets-tabs">
                    <button className="markets-tab active">Perps</button>
                </div>

                <div className="markets-head">
                    <span>Symbol</span>
                    <span>Last Price</span>
                    <span>Max Lev</span>
                </div>

                <div className="markets-list">
                    {loading ? (
                        <div className="markets-empty">Loading markets...</div>
                    ) : filtered.length === 0 ? (
                        <div className="markets-empty">No markets found</div>
                    ) : (
                        filtered.map((market) => {
                            const coin = market.coin
                            const price = prices?.[coin]

                            return (
                                <button
                                    key={coin}
                                    className={`market-row ${selectedCoin === coin ? 'active' : ''}`}
                                    onClick={() => onSelectCoin?.(coin)}
                                >
                                    <div className="market-col symbol">
                                        <span className="market-name">{coin}-USDC</span>
                                    </div>

                                    <div className="market-col">
                                        {price ? fmt(price) : '—'}
                                    </div>

                                    <div className="market-col leverage">
                                        {market.maxLeverage ? `${market.maxLeverage}x` : '—'}
                                    </div>
                                </button>
                            )
                        })
                    )}
                </div>
            </div>
        </div>
    )
}