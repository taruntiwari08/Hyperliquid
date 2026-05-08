import { useState } from 'react'
import { useAccount } from 'wagmi'
import { useBalance } from '../hooks/useBalance'
import { depositUSDC, withdrawUSDC } from '../services/transferService'
import './DepositWithdraw.css'

const QUICK = [10, 50, 100, 500]

export default function DepositWithdraw() {
  const { address, isConnected } = useAccount()
  const balance = useBalance(address)
  const [tab, setTab] = useState('deposit')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [txHash, setTxHash] = useState(null)
  const [error, setError] = useState(null)

  const reset = () => { setError(null); setTxHash(null) }
  const numAmt = Number(amount)
  const bal = Number(balance || 0)

  const handleDeposit = async () => {
    if (!numAmt || numAmt <= 0) return setError('Enter a valid amount')
    if (numAmt < 5) return setError('Minimum deposit is $5 USDC')
    setLoading(true); reset()
    try {
      const res = await depositUSDC(amount)
      setTxHash(res.txHash)
      setAmount('')
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
      setError(null)
      alert('✅ Withdrawal initiated — arrives in ~5 min')
    } catch (e) { setError(e.message || 'Withdrawal failed') }
    finally { setLoading(false) }
  }

  if (!isConnected) return (
    <div className="transfer-panel">
      <div className="panel-empty">Connect wallet to transfer funds</div>
    </div>
  )

  return (
    <div className="transfer-panel">
      {/* Tab switcher */}
      <div className="transfer-tabs">
        <button className={`transfer-tab deposit ${tab === 'deposit' ? 'active' : ''}`} onClick={() => { setTab('deposit'); reset() }}>
          ↓ Deposit
        </button>
        <button className={`transfer-tab withdraw ${tab === 'withdraw' ? 'active' : ''}`} onClick={() => { setTab('withdraw'); reset() }}>
          ↑ Withdraw
        </button>
      </div>

      <div className="transfer-body">
        {/* Info */}
        <div className="transfer-info">
          {tab === 'deposit' ? (
            <><span className="info-icon">ℹ</span>
              <span>Send USDC on <strong>Arbitrum Sepolia</strong>. Min $5. Wallet auto-switches network.</span>
            </>
          ) : (
            <><span className="info-icon">ℹ</span>
              <span>Withdraws to <strong>{address?.slice(0,6)}...{address?.slice(-4)}</strong> on Arbitrum. ~5 min.</span>
            </>
          )}
        </div>

        {/* Amount */}
        <div className="input-wrapper">
          <input
            type="number"
            className="trade-input"
            placeholder="0.00"
            value={amount}
            onChange={e => { setAmount(e.target.value); reset() }}
            min="0"
            step="0.01"
          />
          <span className="input-suffix">USDC</span>
        </div>

        {/* Quick amounts */}
        <div className="pct-row">
          {QUICK.map(v => (
            <button key={v} className="pct-btn" onClick={() => { setAmount(String(v)); reset() }}>
              ${v}
            </button>
          ))}
          {tab === 'withdraw' && bal > 0 && (
            <button className="pct-btn max-btn" onClick={() => { setAmount(bal.toFixed(2)); reset() }}>Max</button>
          )}
        </div>

        {error && (
          <div className="transfer-error"><span>⚠</span> {error}</div>
        )}

        {txHash && (
          <a
            className="transfer-success"
            href={`https://sepolia.arbiscan.io/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            ✓ Tx submitted — {txHash.slice(0, 14)}...
          </a>
        )}

        <button
          className={`transfer-btn ${tab}`}
          onClick={tab === 'deposit' ? handleDeposit : handleWithdraw}
          disabled={loading || !amount}
        >
          {loading ? (
            <span className="btn-loading"><span className="spinner" /> {tab === 'deposit' ? 'Sending...' : 'Withdrawing...'}</span>
          ) : tab === 'deposit' ? (
            `Deposit${amount ? ` $${amount}` : ''} USDC`
          ) : (
            `Withdraw${amount ? ` $${amount}` : ''} USDC`
          )}
        </button>
      </div>
    </div>
  )
}
