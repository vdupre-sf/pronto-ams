import { usd } from '../util.js';

export default function CartDrawer({ open, cart, restaurant, total, onClose, onSetQty, onClear, onCheckout }) {
  const count = cart.reduce((n, i) => n + i.qty, 0);

  return (
    <>
      <div className={`drawer-scrim ${open ? 'show' : ''}`} onClick={onClose} />
      <aside className={`cart-drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
        <div className="cart-head">
          <div>
            <h2>Your order</h2>
            {restaurant && <p className="cart-rest">{restaurant.name}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close cart">✕</button>
        </div>

        {!cart.length ? (
          <div className="cart-empty">
            <span className="cart-empty-emoji">🛒</span>
            <p>Your cart is empty.</p>
            <span>Add dishes from a restaurant to get started.</span>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {cart.map((i) => (
                <div key={i.dishId} className="cart-item">
                  <span className="cart-item-emoji">{i.emoji}</span>
                  <div className="cart-item-info">
                    <div className="cart-item-name">{i.name}</div>
                    <div className="cart-item-price">{usd(i.price)}</div>
                  </div>
                  <div className="qty-stepper sm">
                    <button onClick={() => onSetQty(i.dishId, i.qty - 1)} aria-label="Remove one">−</button>
                    <span>{i.qty}</span>
                    <button onClick={() => onSetQty(i.dishId, i.qty + 1)} aria-label="Add one">+</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="cart-foot">
              <div className="cart-subtotal">
                <span>Subtotal ({count} {count === 1 ? 'item' : 'items'})</span>
                <strong>{usd(total)}</strong>
              </div>
              <button className="btn" onClick={onCheckout}>Go to checkout</button>
              <button className="linklike center" onClick={onClear}>Clear cart</button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
