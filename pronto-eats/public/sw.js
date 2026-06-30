/* Pronto Eats service worker — enables Add-to-Home-Screen install + Web Push. */
const VERSION = 'pronto-v2';

self.addEventListener('install', () => {
  // Activate this worker immediately on first install / update.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// A (no-op) fetch handler keeps the app installable; we let the network handle
// everything (no offline cache — the catalog is always fetched live).
self.addEventListener('fetch', () => {});

// --- Notification history (IndexedDB) ---------------------------------------
// We persist every push we receive so the in-app bell can show past alerts even
// after the OS notification is dismissed. The client reads the same store.
const NOTIF_DB = 'pronto-notif';
const NOTIF_STORE = 'items';
const NOTIF_MAX = 50;

function openNotifDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(NOTIF_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(NOTIF_STORE)) {
        db.createObjectStore(NOTIF_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveNotification(rec) {
  const db = await openNotifDB();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(NOTIF_STORE, 'readwrite');
      tx.objectStore(NOTIF_STORE).add(rec);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    // Trim oldest records beyond NOTIF_MAX (cursor walks ascending = oldest first).
    await new Promise((resolve) => {
      const tx = db.transaction(NOTIF_STORE, 'readwrite');
      const store = tx.objectStore(NOTIF_STORE);
      const countReq = store.count();
      countReq.onsuccess = () => {
        let excess = countReq.result - NOTIF_MAX;
        if (excess <= 0) { resolve(); return; }
        store.openCursor().onsuccess = (e) => {
          const cur = e.target.result;
          if (cur && excess > 0) { cur.delete(); excess--; cur.continue(); }
          else resolve();
        };
      };
      tx.onerror = () => resolve();
    });
  } finally {
    db.close();
  }
}

async function notifyClients() {
  const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of list) client.postMessage({ type: 'push-received' });
}

// --- Web Push: store + show the notification the server delivered ---
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { title: 'Pronto Eats', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Pronto Eats';
  const body = data.body || '';
  const url = data.url || '/';
  const options = {
    body,
    icon: data.icon || '/icon-192.png',
    badge: '/icon-192.png',
    data: { url },
    tag: data.tag || undefined,
    renotify: !!data.tag,
  };
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      saveNotification({ title, body, url, ts: Date.now() })
        .then(notifyClients)
        .catch(() => {}),
    ])
  );
});

// --- Tapping a notification focuses (or opens) the app at the given URL ---
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(url).catch(() => {});
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
