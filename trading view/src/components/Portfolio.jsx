import { useState } from 'react'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useBalance } from '../hooks/useBalance'
import { useTransferHistory } from '../hooks/useTransferHistory'
import { depositUSDC, withdrawUSDC } from '../services/transferService'
import './Portfolio.css'

const QUICK_AMOUNTS = [10, 50, 100, 500]

const fmtTs = (ms) => new Date(ms).toLocaleString(undefined, {
  month: 'short', day: 'numeric',
  hour: '2-digit', minute: '2-digit'
})
const fmtUsd = (n) => '$' + Number(n || 0).toLocaleString(undefined, {
  minimumFractionDigits: 2, maximumFractionDigits: 2
})

function StatCard({ label, value, sub, color }) {
  return (
    <div className="pf-stat-card">
      <span className="pf-stat-label">{label}</span>
      <span className={`pf-stat-value ${color || ''}`}>{value}</span>
      {sub && <span className="pf-stat-sub">{sub}</span>}
    </div>
  )
}

function TransferRow({ row }) {
  const isDeposit = row.isDeposit
  const isWithdraw = row.isWithdrawal
  const typeMap = {
    deposit: 'Deposit', withdraw: 'Withdrawal', transfer: 'Transfer',
    accountClassTransfer: 'Class Transfer', liquidation: 'Liquidation',
    spotTransfer: 'Spot Transfer',
  }
  const label = typeMap[row.type] || row.type

  return (
    <div className="pf-tx-row">
      <div className={`pf-tx-icon ${isDeposit ? 'dep' : isWithdraw ? 'wit' : 'other'}`}>
        {isDeposit ? '↓' : isWithdraw ? '↑' : '↔'}
      </div>
      <div className="pf-tx-info">
        <span className="pf-tx-type">{label}</span>
        <span className="pf-tx-time">{fmtTs(row.time)}</span>
      </div>
      <div className="pf-tx-right">
        <span className={`pf-tx-amount ${isDeposit ? 'pos' : isWithdraw ? 'neg' : ''}`}>
          {isDeposit ? '+' : isWithdraw ? '-' : ''}{fmtUsd(row.amount)}
        </span>
        {row.hash && (
          <a
            className="pf-tx-hash"
            href={`https://app.hyperliquid.xyz/explorer/tx/${row.hash}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {row.hash.slice(0, 8)}...
          </a>
        )}
      </div>
    </div>
  )
}

function Pagination({ page, totalPages, setPage }) {
  if (totalPages <= 1) return null
  return (
    <div className="pf-pagination">
      <button className="pf-page-btn" onClick={() => setPage(1)} disabled={page === 1}>«</button>
      <button className="pf-page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
      <span className="pf-page-info">{page} / {totalPages}</span>
      <button className="pf-page-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</button>
      <button className="pf-page-btn" onClick={() => setPage(totalPages)} disabled={page === totalPages}>»</button>
    </div>
  )
}

export default function Portfolio() {
  const { address, isConnected } = useAccount()
  const balance = useBalance(address)

  // Transfer form
  const [txTab, setTxTab] = useState('deposit') // deposit | withdraw
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [txHash, setTxHash] = useState(null)
  const [error, setError] = useState(null)

  // History filter tab
  const [histTab, setHistTab] = useState('all') // all | deposits | withdrawals

  const {
    rows, loading: histLoading, error: histError,
    tab: histFilterTab, setTab: setHistFilterTab,
    page, setPage, totalPages,
    range, setRange,
    refresh,
    totalDeposited, totalWithdrawn,
    total,
  } = useTransferHistory(address)

  const bal = Number(balance || 0)
  const numAmt = Number(amount)
  const netFlow = totalDeposited - totalWithdrawn

  const reset = () => { setError(null); setTxHash(null) }

  const handleDeposit = async () => {
    if (!numAmt || numAmt <= 0) return setError('Enter a valid amount')
    if (numAmt < 5) return setError('Minimum deposit is $5 USDC')
    setLoading(true); reset()
    try {
      const res = await depositUSDC(amount)
      setTxHash(res.txHash)
      setAmount('')
      refresh()
    } catch (e) { setError(e.message || 'Deposit failed') }
    finally { setLoading(false) }
  }

  const handleWithdraw = async () => {
    if (!numAmt || numAmt <= 0) return setError('Enter a valid amount')
    if (!address) return setError('Connect wallet first')
    if (numAmt > bal) return setError('Exceeds available balance')
    setLoading(true); reset()
    try {
      await withdrawUSDC(amount, address)
      setAmount('')
      reset()
      refresh()
      alert('✅ Withdrawal initiated — arrives in ~5 min')
    } catch (e) { setError(e.message || 'Withdrawal failed') }
    finally { setLoading(false) }
  }

  const RANGES = [
    { value: '30d', label: '30D' },
    { value: '90d', label: '90D' },
    { value: '180d', label: '180D' },
    { value: 'all', label: 'All' },
  ]

  const HIST_TABS = [
    { value: 'all', label: 'All' },
    { value: 'deposits', label: 'Deposits' },
    { value: 'withdrawals', label: 'Withdrawals' },
  ]

  if (!isConnected) {
    return (
      <div className="pf-page">
        <div className="pf-connect-wall">
          <div className="pf-connect-icon">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect x="4" y="14" width="40" height="28" rx="4" stroke="#00d4ff" strokeWidth="1.5"/>
              <path d="M14 14V11a10 10 0 0 1 20 0v3" stroke="#00d4ff" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="24" cy="28" r="3" fill="#00d4ff"/>
            </svg>
          </div>
          <h2 className="pf-connect-title">Connect your wallet</h2>
          <p className="pf-connect-sub">Connect to view your portfolio and manage funds</p>
          <ConnectButton />
        </div>
      </div>
    )
  }

  return (
    <div className="pf-page">
      {/* ── Page header ── */}
      <div className="pf-page-header">
        <div>
          <h1 className="pf-page-title">Portfolio</h1>
          <p className="pf-page-sub">{address?.slice(0, 6)}...{address?.slice(-4)}</p>
        </div>
        <div className="pf-bal-pill">
          <span className="pf-bal-label">Available</span>
          <span className="pf-bal-value">{fmtUsd(bal)}</span>
          <span className="pf-bal-token">USDC</span>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="pf-stats-row">
        <StatCard label="Account Balance" value={fmtUsd(bal)} color="cyan" />
        <StatCard label="Total Deposited" value={fmtUsd(totalDeposited)} color="pos" />
        <StatCard label="Total Withdrawn" value={fmtUsd(totalWithdrawn)} color="neg" />
        <StatCard
          label="Net Flow"
          value={fmtUsd(Math.abs(netFlow))}
          sub={netFlow >= 0 ? '▲ net inflow' : '▼ net outflow'}
          color={netFlow >= 0 ? 'pos' : 'neg'}
        />
      </div>

      {/* ── Main content grid ── */}
      <div className="pf-main-grid">

        {/* LEFT: Transfer form */}
        <div className="pf-transfer-card glass">
          <div className="pf-card-header">
            <span className="pf-card-title">Transfer Funds</span>
          </div>

          {/* Deposit / Withdraw tabs */}
          <div className="pf-tx-tabs">
            <button
              className={`pf-tx-tab ${txTab === 'deposit' ? 'active deposit' : ''}`}
              onClick={() => { setTxTab('deposit'); reset() }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v8M4 7l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Deposit
            </button>
            <button
              className={`pf-tx-tab ${txTab === 'withdraw' ? 'active withdraw' : ''}`}
              onClick={() => { setTxTab('withdraw'); reset() }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 12V4M4 7L7 4l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 2h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Withdraw
            </button>
          </div>

          <div className="pf-form-body">
            {/* Network info */}
            <div className="pf-network-info">
              <div className="pf-network-dot" />
              <span>
                {txTab === 'deposit'
                  ? <>Arbitrum Network· USDC · Min <strong>$5</strong></>
                  : <>Withdraw to <strong>{address?.slice(0, 6)}...{address?.slice(-4)}</strong> · ~5 min</>
                }
              </span>
            </div>

            {/* Amount field */}
            <div className="pf-field">
              <label className="pf-field-label">Amount</label>
              <div className="pf-amount-wrap">
                <input
                  type="number"
                  className="pf-amount-input"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => { setAmount(e.target.value); reset() }}
                  min="0"
                  step="0.01"
                />
                <span className="pf-amount-token">USDC</span>
              </div>
            </div>

            {/* Quick amounts */}
            <div className="pf-quick-row">
              {QUICK_AMOUNTS.map(v => (
                <button key={v} className="pf-quick-btn" onClick={() => { setAmount(String(v)); reset() }}>
                  ${v}
                </button>
              ))}
              {txTab === 'withdraw' && bal > 0 && (
                <button className="pf-quick-btn pf-max-btn" onClick={() => { setAmount(bal.toFixed(2)); reset() }}>
                  Max
                </button>
              )}
            </div>

            {/* Balance hint */}
            {txTab === 'withdraw' && (
              <div className="pf-bal-hint">
                Available: <strong>{fmtUsd(bal)}</strong>
                {numAmt > 0 && numAmt <= bal && (
                  <span className="pf-bal-remaining"> → Remaining: {fmtUsd(bal - numAmt)}</span>
                )}
              </div>
            )}

            {/* Error */}
            {error && <div className="pf-error"><span>⚠</span>{error}</div>}

            {/* Tx hash success */}
            {txHash && (
              <a
                className="pf-success"
                href={`https://sepolia.arbiscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>✓</span>
                <span>Transaction submitted · {txHash.slice(0, 16)}...</span>
              </a>
            )}

            {/* CTA button */}
            <button
              className={`pf-cta-btn ${txTab}`}
              onClick={txTab === 'deposit' ? handleDeposit : handleWithdraw}
              disabled={loading || !amount || Number(amount) <= 0}
            >
              {loading ? (
                <span className="btn-loading">
                  <span className="spinner" />
                  {txTab === 'deposit' ? 'Sending...' : 'Withdrawing...'}
                </span>
              ) : txTab === 'deposit' ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 2v8M4 7l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  {amount ? `Deposit $${amount} USDC` : 'Deposit USDC'}
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 12V4M4 7L7 4l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2 2h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  {amount ? `Withdraw $${amount} USDC` : 'Withdraw USDC'}
                </>
              )}
            </button>
          </div>
        </div>

        {/* RIGHT: Transfer history */}
        <div className="pf-history-card glass">
          <div className="pf-card-header pf-history-header">

            <div className="pf-history-top">
                <span className="pf-card-title">
                Transaction History
                </span>
            </div>
            <div className="pf-hist-controls">
              {/* Filter tabs */}
              <div className="pf-hist-tabs">
                {HIST_TABS.map(t => (
                  <button
                    key={t.value}
                    className={`pf-hist-tab ${histFilterTab === t.value ? 'active' : ''}`}
                    onClick={() => setHistFilterTab(t.value)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {/* Range */}
              <div className="pf-range-row">
                {RANGES.map(r => (
                  <button
                    key={r.value}
                    className={`pf-range-btn ${range === r.value ? 'active' : ''}`}
                    onClick={() => setRange(r.value)}
                  >
                    {r.label}
                  </button>
                ))}
                <button className="pf-refresh-btn" onClick={refresh} title="Refresh">
                  <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
                    <path d="M11 6.5A4.5 4.5 0 1 1 6.5 2c1.2 0 2.3.47 3.1 1.23" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    <path d="M9 1v3h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="pf-tx-list">
            {histLoading ? (
              <div className="pf-hist-loading">
                <span className="spinner" /> Loading transactions...
              </div>
            ) : histError ? (
              <div className="pf-hist-error">⚠ {histError}</div>
            ) : rows.length === 0 ? (
              <div className="pf-hist-empty">
                <svg width="36" height="36" viewBox="0 0 40 40" fill="none" opacity="0.25">
                  <rect x="6" y="10" width="28" height="22" rx="3" stroke="#00d4ff" strokeWidth="1.5"/>
                  <line x1="12" y1="17" x2="28" y2="17" stroke="#00d4ff" strokeWidth="1.5"/>
                  <line x1="12" y1="22" x2="22" y2="22" stroke="#00d4ff" strokeWidth="1.5"/>
                </svg>
                <p>No transactions found</p>
              </div>
            ) : (
              rows.map(r => <TransferRow key={r.id} row={r} />)
            )}
          </div>

          {rows.length > 0 && (
            <Pagination page={page} totalPages={totalPages} setPage={setPage} />
          )}
        </div>
      </div>
    </div>
  )
}