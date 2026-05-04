import { useEffect, useRef, memo } from 'react'
import './TradingViewWidget.css'

function TradingViewWidget() {
  const container = useRef()
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      allow_symbol_change: true,
      calendar: false,
      details: false,
      hide_side_toolbar: false,
      hide_top_toolbar: false,
      hide_legend: false,
      hide_volume: false,
      hotlist: false,
      interval: '60',
      locale: 'en',
      save_image: true,
      style: '1',
      symbol: 'BINANCE:BTCUSDT',
      theme: 'dark',
      timezone: 'Etc/UTC',
      backgroundColor: '#04080f',
      gridColor: 'rgba(255, 152, 0, 0.04)',
      watchlist: [],
      withdateranges: true,
      compareSymbols: [],
      studies: [],
      width: '100%',
      height: '100%',
    })
    container.current.appendChild(script)
  }, [])

  return (
    <div className="chart-wrapper glass">
      <div className="tradingview-widget-container" ref={container} style={{ height: '100%', width: '100%' }}>
        <div className="tradingview-widget-container__widget" style={{ height: '100%', width: '100%' }} />
      </div>
    </div>
  )
}

export default memo(TradingViewWidget)
