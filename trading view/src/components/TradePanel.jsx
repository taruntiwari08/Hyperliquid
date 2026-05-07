import { useState, useEffect } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { usePrices } from '../hooks/usePrices'
import { useBalance } from '../hooks/useBalance'
import { placeTrade } from '../services/tradeService'
import { createOrGetAgent, approveAgent, markAgentApproved } from '../services/agentService'
import { approveBuilderFee } from '../services/builderService'
import './TradePanel.css'
import CoinSearch from './CoinSearch'

const COINS = ['BTC', 'ETH', 'SOL', 'ARB', 'AVAX']
const LEVERAGES = [2, 5, 10, 20, 50]
const BUILDER_ADDRESS = '0x83864EF365f8f26DDEb27f931c91A7b681EE3179'
const BUILDER_FEE_RATE = '0.1%'
const BUILDER_FEE_DECIMAL = 0.001
const BUILDER_VERSION = 'v1'
const EXCHANGE_FEE = 0.00045

export default function TradePanel({ coin, setCoin }) {
  const { isConnected, address } = useAccount()
  const prices = usePrices()
  const balance = useBalance(address)

  const [side, setSide] = useState('long')
  // const [coin, setCoin] = useState('BTC')
  const [leverage, setLeverage] = useState(10)
  const [margin, setMargin] = useState('')
  const [tpEnabled, setTpEnabled] = useState(false)
  const [slEnabled, setSlEnabled] = useState(false)
  const [tpPrice, setTpPrice] = useState('')
  const [slPrice, setSlPrice] = useState('')

  const [loading, setLoading] = useState(false)
  const [agentLoading, setAgentLoading] = useState(false)
  const [agentApproved, setAgentApproved] = useState(false)
  const [agentData, setAgentData] = useState(null)
  const [builderApproved, setBuilderApproved] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [approving, setApproving] = useState(false)

  const builderKey = address
    ? `builderApproved_${address}_${BUILDER_ADDRESS}_${BUILDER_FEE_RATE}_${BUILDER_VERSION}`
    : null

  useEffect(() => {
    if (!address) {
      setAgentData(null); setAgentApproved(false); setBuilderApproved(false); return
    }
    setAgentLoading(true)
    createOrGetAgent(address)
      .then(agent => {
        setAgentData(agent)
        setAgentApproved(Boolean(agent?.isApproved))
        setBuilderApproved(builderKey ? localStorage.getItem(builderKey) === 'true' : false)
      })
      .catch(() => { setAgentApproved(false); setBuilderApproved(false) })
      .finally(() => setAgentLoading(false))
  }, [address])

  const price = Number(prices?.[coin] || 0)
  const bal = Number(balance || 0)
  const marginNum = Number(margin || 0)
  const posValue = marginNum * leverage
  const coinSize = price ? posValue / price : 0
  const liqPrice = price && leverage
    ? side === 'long'
      ? price * (1 - 1 / leverage)
      : price * (1 + 1 / leverage)
    : 0
  const feeExchange = posValue * EXCHANGE_FEE
  const feeBuilder = posValue * BUILDER_FEE_DECIMAL
  const isReady = agentApproved && builderApproved
  const canTrade = isReady && marginNum > 0 && marginNum <= bal && price > 0 && !loading

  const pctButtons = [25, 50, 75, 100]

  const handlePct = (pct) => {
    if (!bal) return
    setMargin(((bal * pct) / 100).toFixed(2))
  }

  const handleEnableTrading = async () => {
    if (!address || !agentData) return
    setApproving(true)
    try {
      if (!agentApproved) {
        await approveAgent(agentData.agentAddress, agentData.agentName)
        await markAgentApproved(address)
        setAgentApproved(true)
      }
      if (!builderApproved) {
        await approveBuilderFee(BUILDER_ADDRESS, BUILDER_FEE_RATE)
        setBuilderApproved(true)
        if (builderKey) localStorage.setItem(builderKey, 'true')
      }
      setShowModal(false)
    } catch (err) {
      alert('❌ ' + (err.message || 'Setup failed'))
    } finally {
      setApproving(false)
    }
  }

  const handleTrade = async () => {
    if (!isReady) { setShowModal(true); return }
    if (!canTrade) return
    if (tpEnabled && tpPrice) {
      const tp = Number(tpPrice)
      if (side === 'long' && tp <= price) return alert('Take Profit must be above market price for LONG')
      if (side === 'short' && tp >= price) return alert('Take Profit must be below market price for SHORT')
    }
    if (slEnabled && slPrice) {
      const sl = Number(slPrice)
      if (side === 'long' && sl >= price) return alert('Stop Loss must be below market price for LONG')
      if (side === 'short' && sl <= price) return alert('Stop Loss must be above market price for SHORT')
    }
    setLoading(true)
    try {
      const res = await placeTrade({
        userAddress: address, coin,
        isLong: side === 'long',
        margin: marginNum, leverage,
        tpPrice: tpEnabled && tpPrice ? Number(tpPrice) : null,
        slPrice: slEnabled && slPrice ? Number(slPrice) : null,
      })
      if (res?.error) {
        if (res.error.includes('Builder') || res.error.includes('builder')) {
          setBuilderApproved(false); if (builderKey) localStorage.removeItem(builderKey)
          setShowModal(true)
        } else if (res.error.includes('Agent')) {
          setAgentApproved(false); setShowModal(true)
        } else alert('❌ ' + res.error)
      } else {
        setMargin(''); setTpPrice(''); setSlPrice('')
        alert('✅ Order placed')
      }
    } catch (e) {
      alert('❌ ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const fmtPrice = (n) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <>
      <div className="trade-panel glass fade-up">
        {/* Coin selector */}
        <CoinSearch value={coin} onChange={setCoin} />

        {/* Price display */}
        <div className="price-display">
          <span className="price-current num">{price ? `$${fmtPrice(price)}` : '—'}</span>
          <span className="price-label">{coin}/USDC · Perpetual</span>
        </div>

        {/* Long / Short */}
        <div className="side-selector">
          <button className={`side-btn long ${side === 'long' ? 'active' : ''}`} onClick={() => setSide('long')}>
            <span className="side-icon">↑</span> Long
          </button>
          <button className={`side-btn short ${side === 'short' ? 'active' : ''}`} onClick={() => setSide('short')}>
            <span className="side-icon">↓</span> Short
          </button>
        </div>

        {/* Trading status */}
        {isConnected && (
          <div className={`trading-status ${isReady ? 'ready' : 'not-ready'}`}>
            <span className="status-dot" />
            {agentLoading ? 'Preparing...' : isReady ? 'Trading enabled' : 'Setup required'}
            {!agentLoading && !isReady && (
              <button className="setup-link" onClick={() => setShowModal(true)}>Enable →</button>
            )}
          </div>
        )}

        {/* Leverage */}
        <div className="field-group">
          <label className="field-label">Leverage</label>
          <div className="leverage-row">
            {LEVERAGES.map(l => (
              <button key={l} className={`lev-btn ${leverage === l ? 'active' : ''}`} onClick={() => setLeverage(l)}>
                {l}×
              </button>
            ))}
          </div>
        </div>

        {/* Margin input */}
        <div className="field-group">
          <div className="field-header">
            <label className="field-label">Margin</label>
            <span className="field-hint num">{bal > 0 ? `Max $${fmtPrice(bal)}` : ''}</span>
          </div>
          <div className="input-wrapper">
            <input
              type="number"
              className="trade-input"
              placeholder="0.00"
              value={margin}
              onChange={e => setMargin(e.target.value)}
              min="0"
            />
            <span className="input-suffix">USDC</span>
          </div>
          <div className="pct-row">
            {pctButtons.map(p => (
              <button key={p} className="pct-btn" onClick={() => handlePct(p)}>{p}%</button>
            ))}
          </div>
        </div>

        {/* Computed size */}
        {coinSize > 0 && (
          <div className="computed-size">
            <span className="size-label">Position size</span>
            <span className="size-value num">{coinSize.toFixed(4)} {coin}</span>
          </div>
        )}

        {/* TP/SL toggles */}
        <div className="tpsl-section">
          <div className="tpsl-row">
            <label className="field-label">Take Profit</label>
            <button
              className={`toggle ${tpEnabled ? 'on' : ''}`}
              onClick={() => setTpEnabled(!tpEnabled)}
              aria-label="Toggle Take Profit"
            >
              <span className="toggle-thumb" />
            </button>
          </div>
          {tpEnabled && (
            <div className="input-wrapper mt-6">
              <input
                type="number"
                className="trade-input"
                placeholder={side === 'long' ? `Above $${fmtPrice(price)}` : `Below $${fmtPrice(price)}`}
                value={tpPrice}
                onChange={e => setTpPrice(e.target.value)}
              />
              <span className="input-suffix tp">TP</span>
            </div>
          )}

          <div className="tpsl-row" style={{ marginTop: '10px' }}>
            <label className="field-label">Stop Loss</label>
            <button
              className={`toggle ${slEnabled ? 'on' : ''}`}
              onClick={() => setSlEnabled(!slEnabled)}
              aria-label="Toggle Stop Loss"
            >
              <span className="toggle-thumb" />
            </button>
          </div>
          {slEnabled && (
            <div className="input-wrapper mt-6">
              <input
                type="number"
                className="trade-input"
                placeholder={side === 'long' ? `Below $${fmtPrice(price)}` : `Above $${fmtPrice(price)}`}
                value={slPrice}
                onChange={e => setSlPrice(e.target.value)}
              />
              <span className="input-suffix sl">SL</span>
            </div>
          )}
        </div>

        {/* Order summary */}
        {marginNum > 0 && (
          <div className="order-summary">
            <div className="summary-row">
              <span>Entry price</span>
              <span className="num">${fmtPrice(price)}</span>
            </div>
            <div className="summary-row">
              <span>Position value</span>
              <span className="num">${fmtPrice(posValue)}</span>
            </div>
            <div className="summary-row">
              <span>Leverage</span>
              <span className="num">{leverage}×</span>
            </div>
            <div className="summary-row warning">
              <span>Est. liquidation</span>
              <span className="num">${fmtPrice(liqPrice)}</span>
            </div>
            {tpEnabled && tpPrice && (
              <div className="summary-row green">
                <span>Take profit</span>
                <span className="num">${fmtPrice(tpPrice)}</span>
              </div>
            )}
            {slEnabled && slPrice && (
              <div className="summary-row red">
                <span>Stop loss</span>
                <span className="num">${fmtPrice(slPrice)}</span>
              </div>
            )}
            <div className="summary-divider" />
            <div className="summary-row muted">
              <span>Exchange fee (0.045%)</span>
              <span className="num">${feeExchange.toFixed(4)}</span>
            </div>
            <div className="summary-row muted">
              <span>Builder fee (0.1%)</span>
              <span className="num">${feeBuilder.toFixed(4)}</span>
            </div>
          </div>
        )}

        {/* CTA */}
        {!isConnected ? (
          <div className="connect-cta">
            <ConnectButton />
          </div>
        ) : (
          <button
            className={`trade-btn ${side} ${canTrade || !isReady ? '' : 'disabled'}`}
            onClick={handleTrade}
            disabled={loading || agentLoading || (isReady && !canTrade)}
          >
            {loading
              ? <span className="btn-loading"><span className="spinner" /> Executing...</span>
              : !isReady
                ? 'Enable Trading'
                : `Place ${side === 'long' ? 'Long' : 'Short'} Order`
            }
          </button>
        )}
      </div>

      {/* Enable trading modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="modal-box glass">
            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            <div className="modal-header">
              <div className="modal-icon">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <polygon points="14,3 25,9 25,19 14,25 3,19 3,9" fill="none" stroke="#ff9800" strokeWidth="1.5" />
                </svg>
              </div>
              <h2 className="modal-title">Enable Trading</h2>
              <p className="modal-subtitle">
                Two gas-free signatures to enable instant, on-chain trading via your personal agent wallet.
              </p>
            </div>

            <div className="modal-steps">
              <div className={`modal-step ${agentApproved ? 'done' : 'pending'}`}>
                <div className="step-num">{agentApproved ? '✓' : '1'}</div>
                <div className="step-info">
                  <div className="step-title">Approve Trading Agent</div>
                  <div className="step-desc">Authorizes your agent wallet to place orders on your behalf</div>
                </div>
              </div>
              <div className={`modal-step ${builderApproved ? 'done' : 'pending'}`}>
                <div className="step-num">{builderApproved ? '✓' : '2'}</div>
                <div className="step-info">
                  <div className="step-title">Approve Builder Fee (0.1%)</div>
                  <div className="step-desc">One-time approval for BigRock platform fee on trades</div>
                </div>
              </div>
            </div>

            <button
              className="modal-cta"
              onClick={handleEnableTrading}
              disabled={approving || (agentApproved && builderApproved)}
            >
              {approving ? (
                <span className="btn-loading"><span className="spinner" /> Approving...</span>
              ) : agentApproved && builderApproved ? (
                '✓ Trading Enabled'
              ) : (
                'Enable Trading'
              )}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
