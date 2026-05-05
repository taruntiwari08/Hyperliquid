import { useState, useCallback } from 'react'
import Header from './components/Header'
import TickerBar from './components/TickerBar'
import TradingViewWidget from './components/TradingViewWidget'
import TradePanel from './components/TradePanel'
import BottomTabs from './components/BottomTabs'
import DepositWithdraw from './components/DepositWithdraw'
import History from './components/History'
import './App.css'

export default function App() {
  const [sidebarOpen, setSidebarOpen]   = useState(false)
  const [activePage,  setActivePage]    = useState('trade') // 'trade' | 'history'

  const openSidebar  = useCallback(() => setSidebarOpen(true),  [])
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  return (
    <div className="app-shell">
      <Header
        onOpenSidebar={openSidebar}
        sidebarOpen={sidebarOpen}
        activePage={activePage}
        onNavigate={setActivePage}
      />
      <TickerBar />

      {activePage === 'trade' ? (
        /* ── TRADE PAGE ── */
        <div className="trading-layout">
          <div className="chart-area">
            <div className="chart-wrap">
              <TradingViewWidget />
            </div>
            <div className="bottom-area">
              <BottomTabs />
            </div>
          </div>

          <div
            className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`}
            onClick={closeSidebar}
          />

          <div className={`right-sidebar ${sidebarOpen ? 'open' : ''}`}>
            <TradePanel onClose={closeSidebar} />
            <DepositWithdraw />
          </div>
        </div>
      ) : (
        /* ── HISTORY PAGE ── */
        <div className="history-page">
          <History fullPage />
        </div>
      )}
    </div>
  )
}