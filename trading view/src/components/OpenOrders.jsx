import { useAccount } from 'wagmi'
import { useOpenOrders } from '../hooks/useOpenOrders'
import './OpenOrders.css'

const f = (n) => {
  if (!n) return '—'
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function OpenOrders() {
  const { address, isConnected } = useAccount()
  const { orders, loading } = useOpenOrders(address)

  if (!isConnected) return (
    <div className="panel glass">
      <div className="panel-header"><span className="panel-title">Open Orders</span></div>
      <div className="panel-empty">Connect wallet</div>
    </div>
  )

  return (
    <div className="panel glass">
      <div className="panel-header">
        <span className="panel-title">TP / SL Orders</span>
        {loading && <span className="panel-updating">Live</span>}
        {orders.length > 0 && <span className="panel-count">{orders.length}</span>}
      </div>

      {orders.length === 0 ? (
        <div className="panel-empty">No trigger orders</div>
      ) : (
        <div className="orders-list">
          {orders.map((order, i) => {
            const isTp = order.triggerCondition?.toLowerCase().includes('tp')
              || order.triggerCondition?.toLowerCase().includes('profit')
            const isSl = order.triggerCondition?.toLowerCase().includes('sl')
              || order.triggerCondition?.toLowerCase().includes('loss')

            return (
              <div key={order.oid || i} className="order-row">
                <div className="order-left">
                  <span className="order-coin">{order.coin}</span>
                  <span className={`order-type-badge ${isTp ? 'tp' : isSl ? 'sl' : 'trigger'}`}>
                    {isTp ? 'TP' : isSl ? 'SL' : 'Trigger'}
                  </span>
                </div>
                <div className="order-right">
                  <span className="order-trigger num">${f(order.triggerPrice)}</span>
                  <span className="order-size num">{order.size} {order.coin}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
