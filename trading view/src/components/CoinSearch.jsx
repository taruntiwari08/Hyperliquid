import { useState, useEffect, useRef } from 'react'
import { useMarkets } from '../hooks/useMarkets'
import './CoinSearch.css'

// Popular coins always shown first
const PINNED = ['BTC','ETH','SOL','ARB','AVAX','DOGE','WIF','PEPE','OP','SUI']

export default function CoinSearch({ value, onChange }) {
    const { coins, loading } = useMarkets()
    const [open,   setOpen]   = useState(false)
    const [query,  setQuery]  = useState('')
    const ref    = useRef()
    const input  = useRef()

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    // Focus input when opened
    useEffect(() => {
        if (open) setTimeout(() => input.current?.focus(), 50)
    }, [open])

    const filtered = query.trim()
        ? coins.filter(c =>
            c.name.toLowerCase().includes(query.toLowerCase())
          )
        : coins

    // Pinned at top, rest after
    const pinned = filtered.filter(c => PINNED.includes(c.name))
    const rest   = filtered.filter(c => !PINNED.includes(c.name))
    const sorted = [...pinned, ...rest]

    const select = (name) => {
        onChange(name)
        setOpen(false)
        setQuery('')
    }

    return (
        <div className="coin-search-wrap" ref={ref}>
            <button className="coin-selector-btn" onClick={() => setOpen(o => !o)}>
                <span className="cs-selected">{value}</span>
                <span className="cs-pair">/USDC</span>
                <svg className={`cs-arrow ${open ? 'up' : ''}`} width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            </button>

            {open && (
                <div className="cs-dropdown glass">
                    {/* Search input */}
                    <div className="cs-search-wrap">
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="cs-search-icon">
                            <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.3"/>
                            <line x1="8.5" y1="8.5" x2="11.5" y2="11.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                        </svg>
                        <input
                            ref={input}
                            className="cs-search-input"
                            placeholder="Search markets..."
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                        />
                        {query && (
                            <button className="cs-clear" onClick={() => setQuery('')}>×</button>
                        )}
                    </div>

                    {/* Pinned header */}
                    {!query && (
                        <div className="cs-section-label">Popular</div>
                    )}

                    {/* List */}
                    <div className="cs-list">
                        {loading ? (
                            <div className="cs-loading">Loading markets...</div>
                        ) : sorted.length === 0 ? (
                            <div className="cs-loading">No results for "{query}"</div>
                        ) : (
                            sorted.map((coin, i) => {
                                const isPinned = PINNED.includes(coin.name)
                                const showRestLabel = !query && !isPinned && sorted[i-1] && PINNED.includes(sorted[i-1].name)
                                return (
                                    <>
                                        {showRestLabel && (
                                            <div key="all-label" className="cs-section-label">All Markets</div>
                                        )}
                                        <button
                                            key={coin.name}
                                            className={`cs-item ${value === coin.name ? 'selected' : ''}`}
                                            onClick={() => select(coin.name)}
                                        >
                                            <div className="cs-item-left">
                                                <span className="cs-coin-name">{coin.name}</span>
                                                <span className="cs-pair-label">/USDC PERP</span>
                                            </div>
                                            <div className="cs-item-right">
                                                <span className="cs-lev">up to {coin.maxLeverage}×</span>
                                                {value === coin.name && (
                                                    <span className="cs-check">✓</span>
                                                )}
                                            </div>
                                        </button>
                                    </>
                                )
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
