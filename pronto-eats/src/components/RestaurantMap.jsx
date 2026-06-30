import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { cuisineForType } from '../data/cuisines.js';
import { usd } from '../util.js';

// Interactive map of the restaurants using their real Latitude__c / Longitude__c
// (all Amsterdam). OpenStreetMap tiles — no API key required. Markers are
// emoji pins; clicking one opens a popup with the chance to view the menu.
export default function RestaurantMap({ restaurants, onOpen }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  useEffect(() => {
    const pts = restaurants.filter((r) => r.lat != null && r.lng != null);
    if (!elRef.current || !pts.length) return;

    const map = L.map(elRef.current, { scrollWheelZoom: false });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const bounds = [];
    for (const r of pts) {
      const c = cuisineForType(r.cuisine);
      const icon = L.divIcon({
        className: 'map-pin-wrap',
        html: `<div class="map-pin" style="--pin-from:${c.from};--pin-to:${c.to}">${c.emoji}</div>`,
        iconSize: [38, 38],
        iconAnchor: [19, 38],
        popupAnchor: [0, -36],
      });
      const rating = r.rating != null ? `★ ${r.rating.toFixed(1)}` : '';
      const price = r.minPrice ? `${usd(r.minPrice)}–${usd(r.maxPrice)}` : '';
      const marker = L.marker([r.lat, r.lng], { icon }).addTo(map);
      marker.bindPopup(
        `<div class="map-popup">
           <strong>${escapeHtml(r.name)}</strong>
           <div class="map-popup-meta">${escapeHtml(c.label)}${rating ? ' · ' + rating : ''}</div>
           ${r.address ? `<div class="map-popup-addr">${escapeHtml(r.address)}</div>` : ''}
           ${price ? `<div class="map-popup-meta">${price} · ${r.dishCount} dishes</div>` : ''}
           <button class="map-popup-btn" data-id="${r.id}">View menu →</button>
         </div>`
      );
      bounds.push([r.lat, r.lng]);
    }

    map.fitBounds(bounds, { padding: [40, 40] });

    map.on('popupopen', (e) => {
      const btn = e.popup.getElement()?.querySelector('.map-popup-btn');
      if (btn) btn.onclick = () => onOpenRef.current?.(btn.dataset.id);
    });

    return () => { map.remove(); mapRef.current = null; };
  }, [restaurants]);

  return <div ref={elRef} className="rest-map" />;
}

function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}
