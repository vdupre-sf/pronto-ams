export default function Confirmation({ order, user, onDone }) {
  if (!order) return null;

  const eta = order.etaMinutes || 30;
  const now = new Date();
  const arrival = new Date(now.getTime() + eta * 60000);
  const arriveStr = arrival.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="confirm-page">
      <div className="confirm-card">
        <div className="confirm-check">✓</div>
        <h1>Order confirmed!</h1>
        <p className="confirm-lead">
          Thanks {user?.firstName || user?.name}, {order.restaurantName || 'the restaurant'} is preparing your food.
        </p>

        <div className="confirm-eta">
          <span className="eta-label">Estimated arrival</span>
          <span className="eta-time">{arriveStr}</span>
          <span className="eta-sub">about {eta} minutes</span>
        </div>

        <div className="confirm-row">
          <span>Order number</span>
          <strong>{order.orderNumber}</strong>
        </div>

        <div className="confirm-track">
          <div className="track-step done"><span>🧾</span>Confirmed</div>
          <div className="track-bar" />
          <div className="track-step active"><span>👨‍🍳</span>Preparing</div>
          <div className="track-bar" />
          <div className="track-step"><span>🛵</span>On the way</div>
          <div className="track-bar" />
          <div className="track-step"><span>🏠</span>Delivered</div>
        </div>

        {!order.persisted && (
          <p className="confirm-note">
            Demo order — not yet saved to Salesforce. Soon the AI assistant will place real orders for you.
          </p>
        )}

        <button className="btn" onClick={onDone}>Back to restaurants</button>
      </div>
    </div>
  );
}
