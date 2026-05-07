import { useMemo } from 'react'
import { usePrices } from '../hooks/usePrices'
import { useMarkets } from '../hooks/useMarkets'
import './TickerBar.css'

const fmt = (n) => {
  const num = Number(n || 0)
  if (!num) return '—'
  if (num >= 1000) return num.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (num >= 1) return num.toFixed(3)
  return num.toFixed(5)
}

const normalizeCoin = (market) => {
  if (typeof market === 'string') return market
  return market?.coin || market?.name || market?.symbol || ''
}

const getLabel = (coin) => `${coin}/USDC`

export default function TickerBar({ selectedCoin, onSelectCoin, onOpenMarkets }) {
  const prices = usePrices()
  const { coins } = useMarkets()

  const marketCoins = useMemo(() => {
    return (coins || [])
      .map(normalizeCoin)
      .filter(Boolean)
  }, [coins])

  const visibleCoins = useMemo(() => {
    const maxVisible = 7

    if (!marketCoins.length) {
      return ['BTC', 'ETH', 'SOL', 'ARB', 'AVAX', 'DOGE', 'MATIC']
    }

    const withoutSelected = marketCoins.filter((c) => c !== selectedCoin)

    if (selectedCoin && marketCoins.includes(selectedCoin)) {
      return [selectedCoin, ...withoutSelected].slice(0, maxVisible)
    }

    return marketCoins.slice(0, maxVisible)
  }, [marketCoins, selectedCoin])

  return (
    <div className="ticker-bar">
      <div className="ticker-left">
        <div className="ticker-inner">
          {visibleCoins.map((coin) => {
            const price = prices?.[coin]

            return (
              <button
                key={coin}
                type="button"
                onClick={() => onSelectCoin?.(coin)}
                className={`ticker-item ${selectedCoin === coin ? 'active' : ''}`}
              >
                <span className="ticker-label">{getLabel(coin)}</span>
                <span className="ticker-price num">
                  {price ? `$${fmt(price)}` : '—'}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <button
        type="button"
        className="ticker-more-btn"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          console.log('More clicked')
          onOpenMarkets?.()
        }}
      >
        More
      </button>
    </div>
  )
}