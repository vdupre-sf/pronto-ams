import { useMemo } from 'react';
import { cuisineForType, deliveryFor, dishEmoji, dishCategory, CATEGORY_ORDER } from '../data/cuisines.js';
import { usd, parseAllergens } from '../util.js';

export default function RestaurantMenu({ restaurant, dishes, cart, onBack, onAdd, onSetQty }) {
  const c = cuisineForType(restaurant.cuisine);
  const { min, max } = deliveryFor(restaurant.avgPrep);

  // qty already in cart, keyed by dishId.
  const qtyById = useMemo(() => {
    const m = {};
    for (const i of cart) m[i.dishId] = i.qty;
    return m;
  }, [cart]);

  // Group dishes by category (classified from the dish NAME, since the org's
  // Category__c field is randomly seeded) in the canonical order.
  const groups = useMemo(() => {
    const byCat = {};
    for (const d of dishes) (byCat[dishCategory(d.name)] ||= []).push(d);
    const ordered = [];
    for (const cat of CATEGORY_ORDER) if (byCat[cat]) ordered.push([cat, byCat[cat]]);
    return ordered;
  }, [dishes]);

  return (
    <div className="menu-page">
      <div className="menu-hero" style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }}>
        <button className="back-btn" onClick={onBack}>← All restaurants</button>
        <div className="menu-hero-inner">
          <span className="menu-emoji">{c.emoji}</span>
          <div>
            <h1>{restaurant.name}</h1>
            <div className="menu-hero-meta">
              {restaurant.rating != null && <><span>★ {restaurant.rating.toFixed(1)}</span><span>·</span></>}
              <span>{c.label}</span>
              <span>·</span>
              <span>{min}–{max} min</span>
              <span>·</span>
              <span>{restaurant.dishCount} dishes</span>
            </div>
            {restaurant.address && <div className="menu-hero-addr">📍 {restaurant.address}</div>}
          </div>
        </div>
      </div>

      <div className="menu-body">
        {groups.map(([cat, items]) => (
          <section key={cat} className="menu-section">
            <h2>{cat}</h2>
            <div className="dish-list">
              {items.map((d) => {
                const emoji = dishEmoji(d.name, cat);
                const qty = qtyById[d.id] || 0;
                const { contains } = parseAllergens(d.allergens);
                return (
                  <div key={d.id} className="dish-row">
                    <div className="dish-emoji">{emoji}</div>
                    <div className="dish-info">
                      <div className="dish-name">{d.name}</div>
                      <div className="dish-tags">
                        {d.prepMinutes != null && <span className="dish-prep">⏱ {d.prepMinutes} min</span>}
                        {contains.length > 0 && (
                          <span className="dish-allergens">⚠ Contains {contains.join(', ')}</span>
                        )}
                      </div>
                      <div className="dish-price">{usd(d.price)}</div>
                    </div>
                    <div className="dish-action">
                      {qty > 0 ? (
                        <div className="qty-stepper">
                          <button onClick={() => onSetQty(d.id, qty - 1)} aria-label="Remove one">−</button>
                          <span>{qty}</span>
                          <button onClick={() => onSetQty(d.id, qty + 1)} aria-label="Add one">+</button>
                        </div>
                      ) : (
                        <button className="add-btn" onClick={() => onAdd(d, emoji)}>Add</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        {!dishes.length && <div className="muted-center">No dishes available right now.</div>}
      </div>
    </div>
  );
}
