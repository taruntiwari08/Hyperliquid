import { usePrices } from '../hooks/usePrices'
import './TickerBar.css'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { useBalance } from '../hooks/useBalance'

const COINS = [
  { id: 'BTC', label: 'BTC/USDC' },
  { id: 'ETH', label: 'ETH/USDC' },
  { id: 'SOL', label: 'SOL/USDC' },
  { id: 'ARB', label: 'ARB/USDC' },
  { id: 'AVAX', label: 'AVAX/USDC' },
  { id: 'DOGE', label: 'DOGE/USDC' },
  { id: 'MATIC', label: 'MATIC/USDC' },
]

const fmt = (n) => {
  const num = Number(n || 0)
  if (num >= 1000) return num.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (num >= 1) return num.toFixed(3)
  return num.toFixed(5)
}

export default function TickerBar() {
  const prices = usePrices()

const { address, isConnected } = useAccount()
const balance = useBalance(address)

  return (
    <div className="ticker-bar">
      <div className="ticker-inner">
        {COINS.map(({ id, label }) => {
          const price = prices?.[id]
          return (
            <div key={id} className="ticker-item">
              <span className="ticker-label">{label}</span>
              <span className="ticker-price num">
                {price ? `$${fmt(price)}` : '—'}
              </span>
            </div>
          )
        })}
      </div>
        {/* <div className="header-right">
        {isConnected && balance && (
          <div className="balance-pill">
            <span className="balance-label">Balance</span>
            <span className="balance-value">${Number(balance).toFixed(2)}</span>
          </div>
        )}
        <div className="connect-wrapper">
          <ConnectButton
            showBalance={false}
            chainStatus="none"
            accountStatus="avatar"
          />
        </div>
      </div> */}
    </div>
  )
}
