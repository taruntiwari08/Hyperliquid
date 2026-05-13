import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useDisconnect } from 'wagmi'
import { useBalance } from '../hooks/useBalance'
import './Header.css'

export default function Header({ activePage, onNavigate }) {
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const balance = useBalance(address)

  return (
    <>
      <header className="header">
        <div className="header-left">
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

            <button
              className={`nav-link ${activePage === 'portfolio' ? 'active' : ''}`}
              onClick={() => onNavigate('portfolio')}
            >
              Portfolio
              {isConnected && balance && (
                <span className="nav-bal">
                  ${Number(balance).toFixed(2)}
                </span>
              )}
            </button>
          </nav>
        </div>

        <div className="header-right">
          <button
            className={`mobile-nav-btn ${activePage === 'history' ? 'active' : ''}`}
            onClick={() => onNavigate(activePage === 'history' ? 'trade' : 'history')}
            aria-label="History"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.3" />
              <path
                d="M7.5 4.5v3l2 1.5"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="mobile-btn-label">History</span>
          </button>

          <button
            className={`mobile-nav-btn ${activePage === 'portfolio' ? 'active' : ''}`}
            onClick={() => onNavigate('portfolio')}
            aria-label="Portfolio"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <rect x="1.5" y="4" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
              <path
                d="M5 4V3a2 2 0 0 1 4 0v1"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
            <span className="mobile-btn-label">Portfolio</span>
          </button>

          <div className="rk-wrap">
            {isConnected ? (
              <button
                className="disconnect-btn"
                onClick={() => disconnect()}
              >
                Disconnect
              </button>
            ) : (
              <ConnectButton
                showBalance={false}
                chainStatus="none"
                accountStatus="avatar"
              />
            )}
          </div>
        </div>
      </header>
    </>
  )
}