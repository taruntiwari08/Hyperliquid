import { useState } from 'react'
import { useAccount } from 'wagmi'
import { usePositions } from '../hooks/usePositions'
import { closePosition } from '../services/closeService'
import './Positions.css'

const f = (n, d = 2) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })

export default function Positions() {
  const { address, isConnected } = useAccount()
  const { positions, loading } = usePositions(address)
  const [closing, setClosing] = useState(null)

  const handleClose = async (coin) => {
    if (!address) return
    setClosing(coin)
    try {
      const res = await closePosition({ coin, address })
      if (res?.error) alert('❌ ' + res.error)
      else alert('✅ Position closed')
    } catch { alert('❌ Close failed') }
    finally { setClosing(null) }
  }

  if (!isConnected) return (
    <div className="panel glass">
      <div className="panel-header"><span className="panel-title">Positions</span></div>
      <div className="panel-empty">Connect wallet to view positions</div>
    </div>
  )

  return (
    <div className="panel glass">
      <div className="panel-header">
        <span className="panel-title">Positions</span>
        {loading && <span className="panel-updating">Live</span>}
        {positions.length > 0 && <span className="panel-count">{positions.length}</span>}
      </div>

      {positions.length === 0 ? (
        <div className="panel-empty">No open positions</div>
      ) : (
        <div className="positions-list">
          {positions.map(pos => {
            const pnlPos = Number(pos.pnl) >= 0
            return (
              <div key={pos.coin} className={`position-card ${pos.isLong ? 'long' : 'short'}`}>
                <div className="pos-top">
                  <div className="pos-coin">
                    <span className="pos-name">{pos.coin}</span>
                    <span className={`pos-side-badge ${pos.isLong ? 'long' : 'short'}`}>
                      {pos.isLong ? '↑ Long' : '↓ Short'}
                    </span>
                  </div>
                  <span className={`pos-pnl ${pnlPos ? 'pos' : 'neg'}`}>
                    {pnlPos ? '+' : ''}${f(pos.pnl)}
                    <span className="pnl-pct"> ({Number(pos.pnlPercent || 0).toFixed(2)}%)</span>
                  </span>
                </div>

                <div className="pos-grid">
                  <div className="pos-stat">
                    <span className="stat-label">Size</span>
                    <span className="stat-value num">{pos.absSize} {pos.coin}</span>
                  </div>
                  <div className="pos-stat">
                    <span className="stat-label">Entry</span>
                    <span className="stat-value num">${f(pos.entryPrice)}</span>
                  </div>
                  <div className="pos-stat">
                    <span className="stat-label">Mark</span>
                    <span className="stat-value num">${f(pos.markPrice)}</span>
                  </div>
                  <div className="pos-stat">
                    <span className="stat-label">Liq.</span>
                    <span className="stat-value num liq">{pos.liquidationPrice ? `$${f(pos.liquidationPrice)}` : '—'}</span>
                  </div>
                  <div className="pos-stat">
                    <span className="stat-label">Margin</span>
                    <span className="stat-value num">${f(pos.marginUsed)}</span>
                  </div>
                  <div className="pos-stat">
                    <span className="stat-label">Leverage</span>
                    <span className="stat-value num">{pos.leverage}×</span>
                  </div>
                </div>

                <button
                  className="close-btn"
                  onClick={() => handleClose(pos.coin)}
                  disabled={closing === pos.coin}
                >
                  {closing === pos.coin ? 'Closing...' : 'Close Position'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
