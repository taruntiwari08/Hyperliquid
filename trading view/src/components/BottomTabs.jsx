import { useState } from 'react'
import { useAccount } from 'wagmi'
import { usePositions } from '../hooks/usePositions'
import { useOpenOrders } from '../hooks/useOpenOrders'
import { closePosition } from '../services/closeService'
import './BottomTabs.css'

const f = (n, d=2) => Number(n||0).toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d})

export default function BottomTabs() {
  const [tab, setTab] = useState('positions')
  const { address, isConnected } = useAccount()
  const { positions, loading: pLoading } = usePositions(address)
  const { orders,    loading: oLoading } = useOpenOrders(address)
  const [closing, setClosing] = useState(null)

  const handleClose = async (coin) => {
    setClosing(coin)
    try {
      const r = await closePosition({ coin, address })
      if (r?.error) alert('❌ ' + r.error)
    } catch { alert('❌ Close failed') }
    finally { setClosing(null) }
  }

  return (
    <div className="btabs">
      {/* Tab bar */}
      <div className="btab-bar">
        <button
          className={`btab ${tab==='positions'?'active':''}`}
          onClick={() => setTab('positions')}
        >
          Positions
          {positions.length > 0 && <span className="btab-badge">{positions.length}</span>}
        </button>
        <button
          className={`btab ${tab==='orders'?'active':''}`}
          onClick={() => setTab('orders')}
        >
          TP / SL
          {orders.length > 0 && <span className="btab-badge">{orders.length}</span>}
        </button>
        {(pLoading || oLoading) && <span className="btab-live">Live</span>}
      </div>

      {/* Content */}
      <div className="btab-content">
        {!isConnected ? (
          <div className="btab-empty">Connect wallet to view</div>
        ) : tab === 'positions' ? (
          positions.length === 0 ? (
            <div className="btab-empty">No open positions</div>
          ) : (
            <div className="pos-table-wrap">
              <table className="pos-table">
                <thead>
                  <tr>
                    <th>Market</th>
                    <th>Side</th>
                    <th>Size</th>
                    <th>Entry</th>
                    <th>Mark</th>
                    <th>Liq.</th>
                    <th>Margin</th>
                    <th>PnL</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map(p => {
                    const pos = Number(p.pnl) >= 0
                    return (
                      <tr key={p.coin}>
                        <td className="td-coin">{p.coin}<span className="td-perp">PERP</span></td>
                        <td><span className={`side-tag ${p.isLong?'long':'short'}`}>{p.isLong?'Long':'Short'}</span></td>
                        <td className="num">{p.absSize}</td>
                        <td className="num">${f(p.entryPrice)}</td>
                        <td className="num">${f(p.markPrice)}</td>
                        <td className="num td-liq">{p.liquidationPrice?`$${f(p.liquidationPrice)}`:'—'}</td>
                        <td className="num">${f(p.marginUsed)}</td>
                        <td className={`num td-pnl ${pos?'pos':'neg'}`}>
                          {pos?'+':''}{f(p.pnl)}<br/>
                          <span className="pnl-pct">({Number(p.pnlPercent||0).toFixed(1)}%)</span>
                        </td>
                        <td>
                          <button
                            className="close-row-btn"
                            onClick={() => handleClose(p.coin)}
                            disabled={closing===p.coin}
                          >
                            {closing===p.coin ? '...' : 'Close'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          orders.length === 0 ? (
            <div className="btab-empty">No trigger orders</div>
          ) : (
            <div className="pos-table-wrap">
              <table className="pos-table">
                <thead>
                  <tr>
                    <th>Market</th>
                    <th>Type</th>
                    <th>Size</th>
                    <th>Trigger</th>
                    <th>Limit</th>
                    <th>Condition</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o,i) => {
                    const isTp = o.triggerCondition?.toLowerCase().includes('tp')||o.triggerCondition?.toLowerCase().includes('profit')
                    const isSl = o.triggerCondition?.toLowerCase().includes('sl')||o.triggerCondition?.toLowerCase().includes('loss')
                    return (
                      <tr key={o.oid||i}>
                        <td className="td-coin">{o.coin}<span className="td-perp">PERP</span></td>
                        <td><span className={`type-tag ${isTp?'tp':isSl?'sl':'trigger'}`}>{isTp?'TP':isSl?'SL':'Trigger'}</span></td>
                        <td className="num">{o.size}</td>
                        <td className="num">{o.triggerPrice?`$${f(o.triggerPrice)}`:'—'}</td>
                        <td className="num">{o.limitPrice?`$${f(o.limitPrice)}`:'—'}</td>
                        <td className="td-cond">{o.triggerCondition||'—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  )
}