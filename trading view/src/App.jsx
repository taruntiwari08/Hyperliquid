import { useState, useCallback } from 'react'
import Header from './components/Header'
import TickerBar from './components/TickerBar'
import TradingViewWidget from './components/TradingViewWidget'
import TradePanel from './components/TradePanel'
import BottomTabs from './components/BottomTabs'
import DepositWithdraw from './components/DepositWithdraw'
import History from './components/History'
import MarketsModal from './components/MarketsModal'
import './App.css'

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activePage, setActivePage] = useState('trade')

  // ✅ GLOBAL SELECTED COIN
  const [selectedCoin, setSelectedCoin] = useState('BTC')

  // ✅ MARKETS MODAL
  const [marketsOpen, setMarketsOpen] = useState(false)

  const openSidebar = useCallback(() => setSidebarOpen(true), [])
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  const openMarkets = useCallback(() => {
    setMarketsOpen(true)
  }, [])

  const closeMarkets = useCallback(() => {
    setMarketsOpen(false)
  }, [])

  const handleSelectCoin = useCallback((coin) => {
    setSelectedCoin(coin)
    setMarketsOpen(false)
  }, [])

  return (
    <div className="app-shell">
      <Header
        onOpenSidebar={openSidebar}
        sidebarOpen={sidebarOpen}
        activePage={activePage}
        onNavigate={setActivePage}
      />

      <TickerBar
        selectedCoin={selectedCoin}
        onSelectCoin={handleSelectCoin}
        onOpenMarkets={openMarkets}
      />

      {activePage === 'trade' ? (
        <div className="trading-layout">
          <div className="chart-area">
            <div className="chart-wrap">
              {/* ✅ keep prop name as coin */}
              <TradingViewWidget coin={selectedCoin} />
            </div>

            <div className="bottom-area">
              <BottomTabs selectedCoin={selectedCoin} />
            </div>
          </div>

          <div
            className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`}
            onClick={closeSidebar}
          />

          <div className={`right-sidebar ${sidebarOpen ? 'open' : ''}`}>
            <div className="sidebar-content">
              {/* ✅ keep prop names as coin/setCoin */}
              <TradePanel
                coin={selectedCoin}
                setCoin={handleSelectCoin}
                onClose={closeSidebar}
              />

              <DepositWithdraw />
            </div>
          </div>
        </div>
      ) : (
        <div className="history-page">
          <History fullPage />
        </div>
      )}

      <MarketsModal
        open={marketsOpen}
        onClose={closeMarkets}
        onSelectCoin={handleSelectCoin}
        selectedCoin={selectedCoin}
      />
    </div>
  )
}