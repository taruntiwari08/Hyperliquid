import TradingViewWidget from './components/TradingViewWidget'
import TradePanel from './components/TradePanel'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import Positions from './components/Positions'
import TransferPanel from './components/DepositWithdraw'
import OpenOrders from './components/OpenOrders'
import TickerBar from './components/TickerBar'
import './App.css'

function App() {
  return (
    <div className="app-shell">
      <TickerBar />

      <main className="trading-layout">
        {/* LEFT — chart + order book */}
        <section className="chart-section">
          <TradingViewWidget />
          <div className="bottom-panels">
            <Positions />
            <OpenOrders />
          </div>
        </section>

        {/* RIGHT — trade + transfer */}
        <aside className="side-panel">
          <TradePanel />
          <TransferPanel />
        </aside>
      </main>
    </div>
  )
}

export default App
