import { useEffect, useRef, memo } from 'react'
import './TradingViewWidget.css'

const getTradingViewSymbol = (coin) => {
  const map = {
    BTC:  'COINBASE:BTCUSDC',
    ETH:  'COINBASE:ETHUSDC',
    SOL:  'COINBASE:SOLUSDC',
    AVAX: 'COINBASE:AVAXUSDC',
    DOGE: 'COINBASE:DOGEUSDC',
    ARB:  'COINBASE:ARBUSDC',
    MATIC:'BINANCE:MATICUSDC',
    OP:   'BINANCE:OPUSDC',
    SUI:  'BINANCE:SUIUSDC',
    WIF:  'BINANCE:WIFUSDC',
    PEPE: 'BINANCE:PEPEUSDC',
  }
  return map[coin] || `COINBASE:${coin}USDC`
}

function TradingViewWidget({ coin = 'BTC' }) {
  const container = useRef(null)

  useEffect(() => {
    if (!container.current) return

    container.current.innerHTML = ''

    const widgetDiv = document.createElement('div')
    widgetDiv.className = 'tradingview-widget-container__widget'
    widgetDiv.style.height = '100%'
    widgetDiv.style.width  = '100%'
    container.current.appendChild(widgetDiv)

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.type  = 'text/javascript'
    script.async = true

    script.innerHTML = JSON.stringify({
      allow_symbol_change: false,
      calendar:            false,
      details:             false,
      hide_side_toolbar:   true,
      hide_top_toolbar:    false,
      hide_legend:         false,
      hide_volume:         false,
      hotlist:             false,
      interval:            '60',
      locale:              'en',
      save_image:          false,
      style:               '1',
      symbol:              getTradingViewSymbol(coin),
      theme:               'dark',
      timezone:            'Etc/UTC',
      backgroundColor:     '#000508',
      gridColor:           'rgba(0, 212, 255, 0.03)',
      watchlist:           [],
      withdateranges:      true,
      compareSymbols:      [],
      studies:             [],
      width:               '100%',
      height:              '100%',
    })

    container.current.appendChild(script)
  }, [coin])

  return (
    <div className="chart-wrapper">
      <div
        className="tradingview-widget-container"
        ref={container}
        style={{ height: '100%', width: '100%' }}
      />
    </div>
  )
}

export default memo(TradingViewWidget)
