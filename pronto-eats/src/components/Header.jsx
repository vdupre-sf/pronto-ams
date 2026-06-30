import NotificationBell from './NotificationBell.jsx';

export default function Header({ user, cartCount, onCart, onHome, onLogout }) {
  const initials = (user?.name || '?')
    .split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <header className="topbar">
      <button className="brand-link" onClick={onHome} aria-label="Pronto home">
        <img src="/pronto-logo.png" alt="Pronto" className="topbar-logo" />
      </button>

      <div className="topbar-right">
        <div className="user-chip" title={user?.email}>
          <span className="avatar">{initials}</span>
          <span className="user-meta">
            <span className="user-name">{user?.firstName || user?.name}</span>
            {user?.city && <span className="user-sub">{user.city}</span>}
          </span>
        </div>

        <NotificationBell user={user} />

        <button className="cart-btn" onClick={onCart} aria-label="Open cart">
          🛒
          {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
        </button>

        <button className="logout-btn" onClick={onLogout} title="Sign out">Sign out</button>
      </div>
    </header>
  );
}
