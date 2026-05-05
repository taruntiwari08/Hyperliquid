import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { useBalance } from '../hooks/useBalance'
import './Header.css'

export default function Header({ onOpenSidebar, activePage, onNavigate }) {
  const { address, isConnected } = useAccount()
  const balance = useBalance(address)

  return (
    <header className="header">
      {/* Logo */}
      <div className="header-left">
        {/* <div className="logo">
          <svg className="logo-mark" width="26" height="26" viewBox="0 0 26 26" fill="none">
            <polygon points="13,2 24,8 24,18 13,24 2,18 2,8"
              fill="none" stroke="#00d4ff" strokeWidth="1.5" strokeLinejoin="round"/>
            <polygon points="13,7 19,11 19,15 13,19 7,15 7,11"
              fill="rgba(0,212,255,0.15)" stroke="rgba(0,212,255,0.5)" strokeWidth="1"/>
            <circle cx="13" cy="13" r="2" fill="#00d4ff"/>
          </svg>
          <span className="logo-text">
            BigRock<span className="logo-accent">.exchange</span>
          </span>
        </div> */}

        <nav className="header-nav">
          <button
            className={`nav-link ${activePage === 'trade' ? 'active' : ''}`}
            onClick={() => onNavigate('trade')}
          >
            Trade
          </button>
          <button
            className={`nav-link ${activePage === 'history' ? 'active' : ''}`}
            onClick={() => onNavigate('history')}
          >
            History
          </button>
          <a href="#" className="nav-link">Markets</a>
          <a href="#" className="nav-link">Portfolio</a>
        </nav>
      </div>

      {/* Right */}
      <div className="header-right">
        {isConnected && balance && (
          <div className="bal-chip">
            <span className="bal-label">Balance</span>
            <span className="bal-val num">${Number(balance).toFixed(2)}</span>
          </div>
        )}

        {/* Mobile: history button */}
        <button
          className={`mobile-hist-btn ${activePage === 'history' ? 'active' : ''}`}
          onClick={() => onNavigate(activePage === 'history' ? 'trade' : 'history')}
          aria-label="History"
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M7.5 4.5v3l2 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="mobile-hist-label">History</span>
        </button>

        {/* Mobile: trade button — only show on trade page */}
        {activePage === 'trade' && (
          <button
            className="mobile-trade-btn"
            onClick={onOpenSidebar}
            aria-label="Open trade panel"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 7h10M9 4l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Trade
          </button>
        )}

        <div className="rk-wrap">
          <ConnectButton showBalance={false} chainStatus="none" accountStatus="avatar" />
        </div>
      </div>
    </header>
  )
}