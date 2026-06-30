import { useEffect, useMemo, useState } from 'react';
import { fetchCatalog } from './api.js';
import Login from './components/Login.jsx';
import Header from './components/Header.jsx';
import RestaurantGrid from './components/RestaurantGrid.jsx';
import RestaurantMenu from './components/RestaurantMenu.jsx';
import CartDrawer from './components/CartDrawer.jsx';
import Checkout from './components/Checkout.jsx';
import Confirmation from './components/Confirmation.jsx';
import AgentFab from './components/AgentFab.jsx';

const USER_KEY = 'pronto_user';

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)) || null; } catch { return null; }
  });

  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [activeId, setActiveId] = useState(null);   // restaurant detail
  const [cart, setCart] = useState([]);             // [{ dishId, name, price, emoji, qty }]
  const [cartRestaurant, setCartRestaurant] = useState(null); // { id, name }
  const [cartOpen, setCartOpen] = useState(false);
  const [stage, setStage] = useState('browse');     // browse | checkout | confirmation
  const [order, setOrder] = useState(null);

  // Load catalog once the user is logged in.
  useEffect(() => {
    if (!user || catalog) return;
    setLoading(true);
    setLoadError('');
    fetchCatalog()
      .then(setCatalog)
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, [user, catalog]);

  function handleLogin(u) {
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    setUser(u);
  }
  function handleLogout() {
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setCatalog(null);
    setCart([]);
    setCartRestaurant(null);
    setActiveId(null);
    setStage('browse');
  }

  const activeRestaurant = useMemo(
    () => catalog?.restaurants.find((r) => r.id === activeId) || null,
    [catalog, activeId]
  );
  const activeDishes = activeId ? catalog?.dishes[activeId] || [] : [];

  const cartCount = cart.reduce((n, i) => n + i.qty, 0);
  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);

  function addToCart(restaurant, dish, emoji) {
    // One restaurant per order (Uber-Eats style).
    if (cartRestaurant && cartRestaurant.id !== restaurant.id && cart.length) {
      const ok = window.confirm(
        `Your cart has items from ${cartRestaurant.name}. Start a new order from ${restaurant.name}?`
      );
      if (!ok) return;
      setCart([{ dishId: dish.id, name: dish.name, price: dish.price, emoji, qty: 1 }]);
      setCartRestaurant({ id: restaurant.id, name: restaurant.name });
      setCartOpen(true);
      return;
    }
    setCartRestaurant({ id: restaurant.id, name: restaurant.name });
    setCart((prev) => {
      const found = prev.find((i) => i.dishId === dish.id);
      if (found) return prev.map((i) => (i.dishId === dish.id ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { dishId: dish.id, name: dish.name, price: dish.price, emoji, qty: 1 }];
    });
    setCartOpen(true);
  }

  function setQty(dishId, qty) {
    setCart((prev) => {
      const next = prev
        .map((i) => (i.dishId === dishId ? { ...i, qty } : i))
        .filter((i) => i.qty > 0);
      if (!next.length) setCartRestaurant(null);
      return next;
    });
  }

  function clearCart() {
    setCart([]);
    setCartRestaurant(null);
  }

  function onOrderPlaced(result) {
    setOrder({ ...result, restaurantName: cartRestaurant?.name });
    clearCart();
    setCartOpen(false);
    setStage('confirmation');
  }

  if (!user) return <Login onLogin={handleLogin} />;

  return (
    <div className="app">
      <Header
        user={user}
        cartCount={cartCount}
        onCart={() => setCartOpen(true)}
        onHome={() => { setActiveId(null); setStage('browse'); }}
        onLogout={handleLogout}
      />

      <main className="content">
        {stage === 'confirmation' && (
          <Confirmation
            order={order}
            user={user}
            onDone={() => { setOrder(null); setActiveId(null); setStage('browse'); }}
          />
        )}

        {stage === 'checkout' && (
          <Checkout
            user={user}
            cart={cart}
            cartTotal={cartTotal}
            restaurant={cartRestaurant}
            onBack={() => setStage('browse')}
            onPlaced={onOrderPlaced}
          />
        )}

        {stage === 'browse' && !activeRestaurant && (
          <RestaurantGrid
            user={user}
            restaurants={catalog?.restaurants || []}
            loading={loading}
            error={loadError}
            onOpen={(id) => setActiveId(id)}
          />
        )}

        {stage === 'browse' && activeRestaurant && (
          <RestaurantMenu
            restaurant={activeRestaurant}
            dishes={activeDishes}
            cart={cart}
            onBack={() => setActiveId(null)}
            onAdd={(dish, emoji) => addToCart(activeRestaurant, dish, emoji)}
            onSetQty={setQty}
          />
        )}
      </main>

      <CartDrawer
        open={cartOpen}
        cart={cart}
        restaurant={cartRestaurant}
        total={cartTotal}
        onClose={() => setCartOpen(false)}
        onSetQty={setQty}
        onClear={clearCart}
        onCheckout={() => { setCartOpen(false); setStage('checkout'); }}
      />

      <AgentFab />
    </div>
  );
}
