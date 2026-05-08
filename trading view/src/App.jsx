import { useState, useCallback } from 'react'
import Header from './components/Header'
import TickerBar from './components/TickerBar'
import TradingViewWidget from './components/TradingViewWidget'
import TradePanel from './components/TradePanel'
import BottomTabs from './components/BottomTabs'
import History from './components/History'
import MarketsModal from './components/MarketsModal'
import OrderBook from './components/OrderBook'
import Portfolio from './components/Portfolio'
import './App.css'

export default function App() {
  const [activePage, setActivePage] = useState('trade')
  const [selectedCoin, setSelectedCoin] = useState('BTC')
  const [marketsOpen, setMarketsOpen] = useState(false)
  const [mobileView, setMobileView] = useState('trade')

  const openMarkets = useCallback(() => setMarketsOpen(true), [])
  const closeMarkets = useCallback(() => setMarketsOpen(false), [])

  const handleSelectCoin = useCallback((coin) => {
    setSelectedCoin(coin)
    setMarketsOpen(false)
  }, [])

  return (
    <div className="app-shell">
      <Header activePage={activePage} onNavigate={setActivePage} />

      {activePage === 'trade' && (
        <TickerBar
          selectedCoin={selectedCoin}
          onSelectCoin={handleSelectCoin}
          onOpenMarkets={openMarkets}
        />
      )}

      {/* ── TRADE PAGE ── */}
      {activePage === 'trade' && (
        <div className="trading-layout">

          {/* ═══ DESKTOP: [Chart + BottomTabs] | [TradePanel + OrderBook] ═══ */}
          <div className="desktop-layout">
            <div className="center-col">
              <div className="chart-wrap">
                <TradingViewWidget coin={selectedCoin} />
              </div>
              <div className="bottom-area">
                <BottomTabs selectedCoin={selectedCoin} />
              </div>
            </div>

            <div className="right-col">
              <div className="right-col-inner">
                <TradePanel coin={selectedCoin} setCoin={handleSelectCoin} />
                <OrderBook coin={selectedCoin} />
              </div>
            </div>
          </div>

          {/* ═══ MOBILE LAYOUT ═══ */}
          <div className="mobile-layout">
            <div className="mobile-view-bar">
              {[
                { id: 'trade', label: 'Trade', icon: <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M9 4l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> },
                { id: 'chart', label: 'Chart', icon: <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><polyline points="1,11 5,6 8,9 13,3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> },
                { id: 'book',  label: 'Book',  icon: <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="1" y="2" width="5" height="10" rx="1" stroke="currentColor" strokeWidth="1.3"/><rect x="8" y="2" width="5" height="10" rx="1" stroke="currentColor" strokeWidth="1.3"/></svg> },
              ].map(v => (
                <button key={v.id} className={`mvb-btn ${mobileView === v.id ? 'active' : ''}`} onClick={() => setMobileView(v.id)}>
                  {v.icon}{v.label}
                </button>
              ))}
            </div>

            <div className="mobile-panel-content">
              {mobileView === 'trade' && <TradePanel coin={selectedCoin} setCoin={handleSelectCoin} />}
              {mobileView === 'chart' && <div className="mobile-chart-view"><TradingViewWidget coin={selectedCoin} /></div>}
              {mobileView === 'book'  && <OrderBook coin={selectedCoin} />}
            </div>

            <div className="mobile-bottom-tabs">
              <BottomTabs selectedCoin={selectedCoin} />
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORY PAGE ── */}
      {activePage === 'history' && (
        <div className="full-page"><History fullPage /></div>
      )}

      {/* ── PORTFOLIO PAGE ── */}
      {activePage === 'portfolio' && (
        <div className="full-page"><Portfolio /></div>
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