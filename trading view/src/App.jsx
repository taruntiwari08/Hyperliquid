import { useState } from 'react'
import TradingViewWidget from './components/TradingViewWidget'
import TradePanel from './components/TradePanel'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import Positions from './components/Positions'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className=' bg-black'>
      < ConnectButton />
      <div className='flex bg-black'>
        <div className='m-4'>
          <TradingViewWidget />
        </div>
        <div className="w-[400px] m-4">
          <TradePanel />
          <Positions />
        </div>
      </div>
    </div >
  )
}

export default App
