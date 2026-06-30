// PWA glue: service-worker registration + Web Push subscription helpers.

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}

// True when launched from the Home Screen (installed PWA), false in a browser tab.
export function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

export function isIOS() {
  const ua = window.navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) ||
    // iPadOS reports as Mac; detect the touch-capable variant.
    (/macintosh/i.test(ua) && 'ontouchend' in document);
}

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function notificationPermission() {
  return 'Notification' in window ? Notification.permission : 'unsupported';
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// Request permission → subscribe via PushManager → register with the server,
// linked to the logged-in Contact. Must be called from a user gesture.
export async function enablePush(user) {
  if (!pushSupported()) throw new Error('Push notifications are not supported on this device.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was not granted.');

  const reg = await navigator.serviceWorker.ready;

  const keyRes = await fetch('/api/push/public-key');
  const { key } = await keyRes.json().catch(() => ({}));
  if (!key) throw new Error('Push is not configured on the server.');

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });
  }

  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscription: sub.toJSON(),
      contactId: user?.id || null,
      email: user?.email || null,
      name: user?.name || null,
    }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to register subscription with the server.');
  }
  return true;
}

export async function existingSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

// --- Notification history (read from the IndexedDB the service worker writes) -
const NOTIF_DB = 'pronto-notif';
const NOTIF_STORE = 'items';

function openNotifDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(NOTIF_DB, 1);
    // Mirror the SW's schema so reading before the first push still works.
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

// Returns past notifications, newest first: [{ id, title, body, url, ts }].
export async function getNotificationHistory() {
  if (!('indexedDB' in window)) return [];
  let db;
  try {
    db = await openNotifDB();
  } catch (_) {
    return [];
  }
  const items = await new Promise((resolve) => {
    const tx = db.transaction(NOTIF_STORE, 'readonly');
    const req = tx.objectStore(NOTIF_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
  db.close();
  return items.sort((a, b) => b.ts - a.ts);
}

export async function clearNotificationHistory() {
  if (!('indexedDB' in window)) return;
  let db;
  try {
    db = await openNotifDB();
  } catch (_) {
    return;
  }
  await new Promise((resolve) => {
    const tx = db.transaction(NOTIF_STORE, 'readwrite');
    tx.objectStore(NOTIF_STORE).clear();
    tx.oncomplete = resolve;
    tx.onerror = resolve;
  });
  db.close();
}

// Recent notifications recorded server-side (the durable source of truth).
// Falls back to [] on any error so the local IndexedDB copy can still show.
export async function fetchServerHistory(contactId) {
  try {
    const qs = contactId ? `?contactId=${encodeURIComponent(contactId)}` : '';
    const res = await fetch(`/api/push/history${qs}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch (_) {
    return [];
  }
}

// Clear this contact's notifications from the server-side history.
export async function clearServerHistory(contactId) {
  if (!contactId) return;
  try {
    await fetch(`/api/push/history?contactId=${encodeURIComponent(contactId)}`, { method: 'DELETE' });
  } catch (_) { /* best effort */ }
}

// Fire `cb` whenever the service worker reports a freshly received push.
export function onPushReceived(cb) {
  if (!('serviceWorker' in navigator)) return () => {};
  const handler = (event) => {
    if (event.data && event.data.type === 'push-received') cb();
  };
  navigator.serviceWorker.addEventListener('message', handler);
  return () => navigator.serviceWorker.removeEventListener('message', handler);
}
