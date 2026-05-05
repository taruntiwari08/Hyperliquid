import { useState } from 'react'
import { useAccount } from 'wagmi'
import { useTradeHistory } from '../hooks/useTradeHistory'
import { useTransferHistory } from '../hooks/useTransferHistory'
import './History.css'

const fmt    = (n, d=2) => Number(n||0).toLocaleString(undefined, {minimumFractionDigits:d, maximumFractionDigits:d})
const fmtTs  = (ms) => new Date(ms).toLocaleString(undefined, {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})
const fmtUsd = (n) => '$' + fmt(n, 2)

// ── Sub-components ──────────────────────────────────────────────

function RangeSelector({ value, onChange, options }) {
    return (
        <div className="hist-range">
            {options.map(o => (
                <button
                    key={o.value}
                    className={`range-btn ${value === o.value ? 'active' : ''}`}
                    onClick={() => onChange(o.value)}
                >
                    {o.label}
                </button>
            ))}
        </div>
    )
}

function Pagination({ page, totalPages, setPage }) {
    if (totalPages <= 1) return null
    return (
        <div className="hist-pagination">
            <button className="page-btn" onClick={() => setPage(1)} disabled={page === 1}>«</button>
            <button className="page-btn" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}>‹</button>
            <span className="page-info">{page} / {totalPages}</span>
            <button className="page-btn" onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}>›</button>
            <button className="page-btn" onClick={() => setPage(totalPages)} disabled={page === totalPages}>»</button>
        </div>
    )
}

function EmptyState({ message }) {
    return (
        <div className="hist-empty">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" opacity="0.3">
                <rect x="6" y="10" width="28" height="22" rx="3" stroke="#00d4ff" strokeWidth="1.5"/>
                <line x1="12" y1="17" x2="28" y2="17" stroke="#00d4ff" strokeWidth="1.5"/>
                <line x1="12" y1="22" x2="22" y2="22" stroke="#00d4ff" strokeWidth="1.5"/>
            </svg>
            <p>{message}</p>
        </div>
    )
}

// ── Trade History Tab ─────────────────────────────────────────

function TradeHistoryTab({ address }) {
    const {
        fills, loading, error, page, setPage, totalPages,
        filter, setFilter, range, setRange, refresh, total, allFills
    } = useTradeHistory(address)

    const FILTERS = [
        { value: 'all',   label: 'All' },
        { value: 'open',  label: 'Opens' },
        { value: 'close', label: 'Closes' },
        { value: 'long',  label: 'Longs' },
        { value: 'short', label: 'Shorts' },
    ]

    const RANGES = [
        { value: '7d',  label: '7D' },
        { value: '30d', label: '30D' },
        { value: '90d', label: '90D' },
        { value: 'all', label: 'All' },
    ]

    // Stats
    const totalPnl   = allFills.reduce((s, f) => s + Number(f.closedPnl || 0), 0)
    const totalFees  = allFills.reduce((s, f) => s + Number(f.fee || 0), 0)
    const totalVol   = allFills.reduce((s, f) => s + (Number(f.price || 0) * Number(f.size || 0)), 0)
    const winTrades  = allFills.filter(f => Number(f.closedPnl) > 0).length
    const winRate    = allFills.length > 0 ? ((winTrades / allFills.length) * 100).toFixed(1) : '—'

    return (
        <div className="hist-tab-content">
            {/* Stats bar */}
            <div className="hist-stats">
                <div className="hist-stat">
                    <span className="hstat-label">Total Trades</span>
                    <span className="hstat-val num">{total}</span>
                </div>
                <div className="hist-stat">
                    <span className="hstat-label">Volume</span>
                    <span className="hstat-val num">{fmtUsd(totalVol)}</span>
                </div>
                <div className="hist-stat">
                    <span className="hstat-label">Realized PnL</span>
                    <span className={`hstat-val num ${totalPnl >= 0 ? 'pos' : 'neg'}`}>
                        {totalPnl >= 0 ? '+' : ''}{fmtUsd(totalPnl)}
                    </span>
                </div>
                <div className="hist-stat">
                    <span className="hstat-label">Fees Paid</span>
                    <span className="hstat-val num">{fmtUsd(totalFees)}</span>
                </div>
                <div className="hist-stat">
                    <span className="hstat-label">Win Rate</span>
                    <span className="hstat-val num">{winRate}%</span>
                </div>
            </div>

            {/* Controls */}
            <div className="hist-controls">
                <div className="hist-filters">
                    {FILTERS.map(f => (
                        <button
                            key={f.value}
                            className={`filter-btn ${filter === f.value ? 'active' : ''}`}
                            onClick={() => setFilter(f.value)}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
                <div className="hist-controls-right">
                    <RangeSelector value={range} onChange={setRange} options={RANGES} />
                    <button className="refresh-btn" onClick={refresh} title="Refresh">
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                            <path d="M11 6.5A4.5 4.5 0 1 1 6.5 2c1.2 0 2.3.47 3.1 1.23" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                            <path d="M9 1v3h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    </button>
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div className="hist-loading"><span className="spinner" /> Loading trades...</div>
            ) : error ? (
                <div className="hist-error">⚠ {error}</div>
            ) : fills.length === 0 ? (
                <EmptyState message="No trades found for this period" />
            ) : (
                <>
                    <div className="hist-table-wrap">
                        <table className="hist-table">
                            <thead>
                                <tr>
                                    <th>Time</th>
                                    <th>Market</th>
                                    <th>Direction</th>
                                    <th>Side</th>
                                    <th>Price</th>
                                    <th>Size</th>
                                    <th>Value</th>
                                    <th>PnL</th>
                                    <th>Fee</th>
                                </tr>
                            </thead>
                            <tbody>
                                {fills.map(f => {
                                    const pnl    = Number(f.closedPnl || 0)
                                    const isLong = f.dir?.toLowerCase().includes('long')
                                    const isOpen = f.dir?.toLowerCase().includes('open')
                                    return (
                                        <tr key={`${f.id}-${f.time}`}>
                                            <td className="td-time">{fmtTs(f.time)}</td>
                                            <td className="td-coin">
                                                {f.coin}
                                                <span className="td-perp">PERP</span>
                                            </td>
                                            <td>
                                                <span className={`dir-tag ${isOpen ? 'open' : 'close'}`}>
                                                    {f.dir || '—'}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`side-tag ${isLong ? 'long' : 'short'}`}>
                                                    {f.side}
                                                </span>
                                            </td>
                                            <td className="num">${fmt(f.price)}</td>
                                            <td className="num">{fmt(f.size, 4)}</td>
                                            <td className="num">{fmtUsd(f.value)}</td>
                                            <td className={`num ${pnl > 0 ? 'pos' : pnl < 0 ? 'neg' : 'neutral'}`}>
                                                {pnl === 0 ? '—' : `${pnl > 0 ? '+' : ''}${fmtUsd(pnl)}`}
                                            </td>
                                            <td className="num td-fee">{fmtUsd(f.fee)}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                    <Pagination page={page} totalPages={totalPages} setPage={setPage} />
                </>
            )}
        </div>
    )
}

// ── Transfer History Tab ──────────────────────────────────────

function TransferHistoryTab({ address }) {
    const {
        rows, loading, error, tab, setTab, page, setPage, totalPages,
        range, setRange, refresh, total, totalDeposited, totalWithdrawn
    } = useTransferHistory(address)

    const TABS = [
        { value: 'all',         label: 'All' },
        { value: 'deposits',    label: 'Deposits' },
        { value: 'withdrawals', label: 'Withdrawals' },
    ]

    const RANGES = [
        { value: '30d',  label: '30D' },
        { value: '90d',  label: '90D' },
        { value: '180d', label: '180D' },
        { value: 'all',  label: 'All' },
    ]

    const typeLabel = (type) => {
        const map = {
            deposit:              'Deposit',
            withdraw:             'Withdrawal',
            transfer:             'Transfer',
            accountClassTransfer: 'Class Transfer',
            liquidation:          'Liquidation',
            spotTransfer:         'Spot Transfer',
        }
        return map[type] || type
    }

    const typeClass = (type) => {
        if (type === 'deposit')  return 'dep'
        if (type === 'withdraw') return 'wit'
        if (type === 'liquidation') return 'liq'
        return 'other'
    }

    return (
        <div className="hist-tab-content">
            {/* Stats */}
            <div className="hist-stats">
                <div className="hist-stat">
                    <span className="hstat-label">Total Deposited</span>
                    <span className="hstat-val num pos">{fmtUsd(totalDeposited)}</span>
                </div>
                <div className="hist-stat">
                    <span className="hstat-label">Total Withdrawn</span>
                    <span className="hstat-val num neg">{fmtUsd(totalWithdrawn)}</span>
                </div>
                <div className="hist-stat">
                    <span className="hstat-label">Net Flow</span>
                    <span className={`hstat-val num ${(totalDeposited - totalWithdrawn) >= 0 ? 'pos' : 'neg'}`}>
                        {fmtUsd(totalDeposited - totalWithdrawn)}
                    </span>
                </div>
                <div className="hist-stat">
                    <span className="hstat-label">Total Transactions</span>
                    <span className="hstat-val num">{total}</span>
                </div>
            </div>

            {/* Controls */}
            <div className="hist-controls">
                <div className="hist-filters">
                    {TABS.map(t => (
                        <button
                            key={t.value}
                            className={`filter-btn ${tab === t.value ? 'active' : ''}`}
                            onClick={() => setTab(t.value)}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
                <div className="hist-controls-right">
                    <RangeSelector value={range} onChange={setRange} options={RANGES} />
                    <button className="refresh-btn" onClick={refresh} title="Refresh">
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                            <path d="M11 6.5A4.5 4.5 0 1 1 6.5 2c1.2 0 2.3.47 3.1 1.23" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                            <path d="M9 1v3h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="hist-loading"><span className="spinner" /> Loading transfers...</div>
            ) : error ? (
                <div className="hist-error">⚠ {error}</div>
            ) : rows.length === 0 ? (
                <EmptyState message="No transfers found for this period" />
            ) : (
                <>
                    <div className="hist-table-wrap">
                        <table className="hist-table">
                            <thead>
                                <tr>
                                    <th>Time</th>
                                    <th>Type</th>
                                    <th>Amount (USDC)</th>
                                    <th>Tx Hash</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map(r => (
                                    <tr key={r.id}>
                                        <td className="td-time">{fmtTs(r.time)}</td>
                                        <td>
                                            <span className={`type-tag ${typeClass(r.type)}`}>
                                                {typeLabel(r.type)}
                                            </span>
                                        </td>
                                        <td className={`num ${r.isDeposit ? 'pos' : r.isWithdrawal ? 'neg' : ''}`}>
                                            {r.isDeposit ? '+' : r.isWithdrawal ? '-' : ''}
                                            {fmtUsd(r.amount)}
                                        </td>
                                        <td className="td-hash">
                                            {r.hash ? (
                                                <a
                                                    href={`https://app.hyperliquid${process.env.NODE_ENV === 'testnet' ? '-testnet' : ''}.xyz/explorer/tx/${r.hash}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="hash-link"
                                                >
                                                    {r.hash.slice(0,10)}...{r.hash.slice(-6)}
                                                </a>
                                            ) : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <Pagination page={page} totalPages={totalPages} setPage={setPage} />
                </>
            )}
        </div>
    )
}

// ── Main History Component ────────────────────────────────────

export default function History({ defaultTab = 'trades', fullPage = false }) {
    const { address, isConnected } = useAccount()
    const [activeTab, setActiveTab] = useState(defaultTab)

    if (!isConnected) return (
        <div className="history-panel glass">
            <div className="hist-header">
                <h2 className="hist-title">History</h2>
            </div>
            <EmptyState message="Connect wallet to view history" />
        </div>
    )

    return (
        <div className={`history-panel ${fullPage ? 'full-page' : 'glass fade-up'}`}>
            <div className="hist-header">
                <h2 className="hist-title">History</h2>
                <div className="hist-main-tabs">
                    <button
                        className={`main-tab ${activeTab === 'trades' ? 'active' : ''}`}
                        onClick={() => setActiveTab('trades')}
                    >
                        Trade History
                    </button>
                    <button
                        className={`main-tab ${activeTab === 'transfers' ? 'active' : ''}`}
                        onClick={() => setActiveTab('transfers')}
                    >
                        Deposits / Withdrawals
                    </button>
                </div>
            </div>

            {activeTab === 'trades'
                ? <TradeHistoryTab address={address} />
                : <TransferHistoryTab address={address} />
            }
        </div>
    )
}
