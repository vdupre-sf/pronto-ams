import { useMemo, useState } from 'react';
import { cuisineForType, deliveryFor } from '../data/cuisines.js';
import { usd } from '../util.js';
import RestaurantMap from './RestaurantMap.jsx';

export default function RestaurantGrid({ user, restaurants, loading, error, onOpen }) {
  const [q, setQ] = useState('');
  const [cuisineFilter, setCuisineFilter] = useState('All');
  const [view, setView] = useState('list'); // list | map

  // Build the set of cuisines present (from the real Restaurant_Type__c), for chips.
  const cuisines = useMemo(() => {
    const set = new Set(restaurants.map((r) => cuisineForType(r.cuisine).label));
    return ['All', ...[...set].sort()];
  }, [restaurants]);

  const filtered = useMemo(() => {
    return restaurants.filter((r) => {
      const c = cuisineForType(r.cuisine).label;
      if (cuisineFilter !== 'All' && c !== cuisineFilter) return false;
      if (q && !(`${r.name} ${c} ${r.address || ''}`.toLowerCase().includes(q.toLowerCase()))) return false;
      return true;
    });
  }, [restaurants, q, cuisineFilter]);

  return (
    <div className="browse">
      <div className="hero-bar">
        <h1>Good evening, {user?.firstName || 'there'} 👋</h1>
        <p>What are you craving? {restaurants.length} restaurants in Amsterdam.</p>
        <input
          className="search"
          placeholder="Search restaurants, cuisines or streets…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="browse-controls">
        <div className="chips">
          {cuisines.map((c) => (
            <button
              key={c}
              className={`chip ${cuisineFilter === c ? 'active' : ''}`}
              onClick={() => setCuisineFilter(c)}
            >
              {c === 'All' ? '🍽️ All' : `${emojiForLabel(c)} ${c}`}
            </button>
          ))}
        </div>

        <div className="view-toggle">
          <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>☰ List</button>
          <button className={view === 'map' ? 'active' : ''} onClick={() => setView('map')}>📍 Map</button>
        </div>
      </div>

      {loading && <div className="muted-center">Loading restaurants…</div>}
      {error && <div className="errbox">{error}</div>}

      {!loading && !error && view === 'map' && (
        <RestaurantMap restaurants={filtered} onOpen={onOpen} />
      )}

      {!loading && !error && view === 'list' && (
        <div className="rest-grid">
          {filtered.map((r) => <RestaurantCard key={r.id} r={r} onOpen={onOpen} />)}
          {!filtered.length && <div className="muted-center">No restaurants match your search.</div>}
        </div>
      )}
    </div>
  );
}

// Resolve a chip's emoji from its cuisine label (chips are built from labels).
function emojiForLabel(label) {
  const byLabel = {
    Greek: 'greek', Thai: 'thai', Lebanese: 'lebanese', Italian: 'italian',
    Pizza: 'pizza', Burgers: 'burger', Mexican: 'mexican', Chinese: 'chinese',
    Sushi: 'sushi', Indian: 'indian',
  };
  return cuisineForType(byLabel[label] || '').emoji;
}

function RestaurantCard({ r, onOpen }) {
  const c = cuisineForType(r.cuisine);
  const { min, max } = deliveryFor(r.avgPrep);

  return (
    <button className="rest-card" onClick={() => onOpen(r.id)}>
      <div className="rest-hero" style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }}>
        <span className="rest-emoji">{c.emoji}</span>
        {r.rating != null && <span className="rest-rating">★ {r.rating.toFixed(1)}</span>}
      </div>
      <div className="rest-body">
        <div className="rest-title-row">
          <h3>{r.name}</h3>
        </div>
        <div className="rest-meta">
          <span className="cuisine-tag">{c.label}</span>
          <span>·</span>
          <span>{min}–{max} min</span>
          <span>·</span>
          <span>{r.dishCount} dishes</span>
        </div>
        {r.address && <div className="rest-addr">📍 {r.address}</div>}
        <div className="rest-sub">
          <span>{usd(r.minPrice)}–{usd(r.maxPrice)}</span>
        </div>
      </div>
    </button>
  );
}
