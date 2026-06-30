import { useMemo, useState } from 'react';
import { placeOrder } from '../api.js';
import { DELIVERY_FEE, SERVICE_RATE } from '../data/cuisines.js';
import { usd } from '../util.js';

export default function Checkout({ user, cart, cartTotal, restaurant, onBack, onPlaced }) {
  const [address, setAddress] = useState('');
  const [city, setCity] = useState(user?.city || '');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  const fees = useMemo(() => {
    const service = Math.round(cartTotal * SERVICE_RATE * 100) / 100;
    const grand = Math.round((cartTotal + DELIVERY_FEE + service) * 100) / 100;
    return { service, grand };
  }, [cartTotal]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setStatus('busy');
    try {
      const result = await placeOrder({
        user: { id: user?.id, name: user?.name, email: user?.email },
        restaurantName: restaurant?.name || null,
        restaurant: restaurant ? { id: restaurant.id, name: restaurant.name } : null,
        items: cart.map((i) => ({ dishId: i.dishId, name: i.name, price: i.price, qty: i.qty })),
        subtotal: cartTotal,
        deliveryFee: DELIVERY_FEE,
        serviceFee: fees.service,
        total: fees.grand,
        delivery: { address, city, notes },
      });
      onPlaced(result);
    } catch (err) {
      setError(err.message);
      setStatus('idle');
    }
  }

  return (
    <div className="checkout-page">
      <button className="back-btn dark" onClick={onBack}>← Back to menu</button>
      <h1>Checkout</h1>

      <div className="checkout-grid">
        <form className="checkout-form" onSubmit={submit}>
          <h2>Delivery details</h2>

          <label>
            <span className="cap">Name</span>
            <input value={user?.name || ''} disabled />
          </label>

          <label>
            <span className="cap">Delivery address <span className="req">*</span></span>
            <input
              required placeholder="Street and number"
              value={address} onChange={(e) => setAddress(e.target.value)}
            />
          </label>

          <label>
            <span className="cap">City <span className="req">*</span></span>
            <input
              required placeholder="City"
              value={city} onChange={(e) => setCity(e.target.value)}
            />
          </label>

          <label>
            <span className="cap">Delivery notes</span>
            <textarea
              rows={2} placeholder="e.g. ring the doorbell, leave at the door"
              value={notes} onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          {error && <div className="errbox">{error}</div>}

          <button className="btn" type="submit" disabled={status === 'busy' || !cart.length}>
            {status === 'busy' ? 'Placing order…' : `Place order · ${usd(fees.grand)}`}
          </button>
        </form>

        <aside className="checkout-summary">
          <h2>{restaurant?.name || 'Your order'}</h2>
          <div className="summary-items">
            {cart.map((i) => (
              <div key={i.dishId} className="summary-line">
                <span className="summary-qty">{i.qty}×</span>
                <span className="summary-name">{i.emoji} {i.name}</span>
                <span className="summary-amt">{usd(i.price * i.qty)}</span>
              </div>
            ))}
          </div>

          <div className="summary-totals">
            <div><span>Subtotal</span><span>{usd(cartTotal)}</span></div>
            <div><span>Delivery fee</span><span>{usd(DELIVERY_FEE)}</span></div>
            <div><span>Service fee</span><span>{usd(fees.service)}</span></div>
            <div className="grand"><span>Total</span><span>{usd(fees.grand)}</span></div>
          </div>
        </aside>
      </div>
    </div>
  );
}
