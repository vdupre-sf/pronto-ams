import 'dotenv/config';
import express from 'express';
import webpush from 'web-push';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  isSalesforceConfigured, findContactByEmail, getCatalog,
  upsertPushSubscription, getPushSubscriptions, deactivatePushSubscription,
} from './salesforce.js';

const app = express();
const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000; // Heroku assigns PORT — never hardcode

app.use(express.json());
app.use(express.static(join(__dirname, 'dist')));

const configured = isSalesforceConfigured();
console.log('Salesforce:', configured ? '✓ client_credentials configured' : '⚠ NOT configured (missing env vars)');

// --- Web Push (VAPID) setup ---
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const pushReady = !!(VAPID_PUBLIC && VAPID_PRIVATE);
if (pushReady) {
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:demo@pronto-eats.example', VAPID_PUBLIC, VAPID_PRIVATE);
}
console.log('Web Push:', pushReady ? '✓ VAPID configured' : '⚠ NOT configured (missing VAPID keys)');

// Server-side notification history (source of truth for the in-app bell).
// iOS terminates PWA service workers aggressively, so a background push's
// on-device IndexedDB write can be lost. The server reliably records every
// delivered push here so the bell can show a complete, durable list.
const PUSH_HISTORY_MAX = 100;
const pushHistory = []; // newest last; [{ ts, title, body, url, contactId, all }]
function recordPush(entry) {
  pushHistory.push(entry);
  if (pushHistory.length > PUSH_HISTORY_MAX) pushHistory.splice(0, pushHistory.length - PUSH_HISTORY_MAX);
}

// --- Login: identify a Contact by email (no password — demo) ---
app.post('/api/login', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email || !/.+@.+\..+/.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (!configured) return res.status(503).json({ error: 'Salesforce is not configured.' });

    const user = await findContactByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'No account found for that email. Try another contact in the org.' });
    }
    res.json({ ok: true, user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- Catalog: all restaurants + dishes ---
app.get('/api/catalog', async (req, res) => {
  try {
    if (!configured) return res.status(503).json({ error: 'Salesforce is not configured.' });
    const catalog = await getCatalog({ force: req.query.refresh === '1' });
    res.json({ ok: true, ...catalog });
  } catch (err) {
    console.error('Catalog error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- Order: client-side only for now. Echo back a confirmation + order number. ---
// (No Salesforce write yet — the future agent / Apex action will persist orders.)
app.post('/api/order', async (req, res) => {
  try {
    const { items, restaurantName, total, user } = req.body || {};
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: 'Your cart is empty.' });
    }
    const orderNumber = 'PR-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    const etaMinutes = 25 + Math.floor(Math.random() * 20);
    console.log(`Order ${orderNumber}: ${items.length} item(s) from ${restaurantName} for ${user?.email || 'guest'} — USD ${total}`);
    res.json({ ok: true, orderNumber, etaMinutes, persisted: false });
  } catch (err) {
    console.error('Order error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- Push: expose the VAPID public key for the client to subscribe with ---
app.get('/api/push/public-key', (req, res) => {
  res.json({ key: pushReady ? VAPID_PUBLIC : null });
});

// --- Push: register a device subscription (linked to the logged-in Contact) ---
app.post('/api/push/subscribe', async (req, res) => {
  try {
    if (!pushReady) return res.status(503).json({ error: 'Push is not configured.' });
    if (!configured) return res.status(503).json({ error: 'Salesforce is not configured.' });
    const { subscription, contactId, email } = req.body || {};
    if (!subscription?.endpoint || !subscription?.keys) {
      return res.status(400).json({ error: 'Invalid subscription.' });
    }
    await upsertPushSubscription({ subscription, contactId, email });
    res.json({ ok: true });
  } catch (err) {
    console.error('Subscribe error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- Push: send a notification. Called by the Salesforce Apex action via a
//     Named Credential; authenticated with a shared secret header. ---
//     Body: { contactId?, all?, title, body?, url? }
app.post('/api/push/send', async (req, res) => {
  try {
    if (!pushReady) return res.status(503).json({ error: 'Push is not configured.' });
    if (!configured) return res.status(503).json({ error: 'Salesforce is not configured.' });

    const secret = req.get('X-Push-Secret');
    if (!process.env.PUSH_SHARED_SECRET || secret !== process.env.PUSH_SHARED_SECRET) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const { contactId, all, title, body, url } = req.body || {};
    if (!title) return res.status(400).json({ error: 'title is required.' });
    if (!all && !contactId) return res.status(400).json({ error: 'Provide contactId or set all=true.' });

    const subs = await getPushSubscriptions(all ? {} : { contactId });
    if (!subs.length) return res.json({ ok: true, sent: 0, targeted: 0, message: 'No active subscriptions.' });

    const payload = JSON.stringify({ title, body: body || '', url: url || '/', icon: '/icon-192.png' });
    let sent = 0, removed = 0;
    await Promise.all(subs.map(async (s) => {
      const sub = { endpoint: s.Endpoint__c, keys: { p256dh: s.P256dh__c, auth: s.Auth__c } };
      try {
        await webpush.sendNotification(sub, payload);
        sent++;
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) {
          await deactivatePushSubscription(s.Id);
          removed++;
        } else {
          console.error('Push send error:', e.statusCode, e.body || e.message);
        }
      }
    }));
    // Record in server-side history if we delivered to at least one device.
    if (sent > 0) {
      recordPush({ ts: Date.now(), title, body: body || '', url: url || '/', contactId: contactId || null, all: !!all });
    }
    res.json({ ok: true, sent, removed, targeted: subs.length });
  } catch (err) {
    console.error('Send error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Recent notifications for the in-app bell. With ?contactId=X, returns pushes
// that targeted that contact plus any broadcasts; without it, the last N.
app.get('/api/push/history', (req, res) => {
  const { contactId } = req.query;
  const items = pushHistory
    .filter((n) => !contactId || n.all || n.contactId === contactId)
    .slice(-50)
    .reverse()
    .map((n) => ({ title: n.title, body: n.body, url: n.url, ts: n.ts }));
  res.json({ items });
});

// Clear a contact's own notifications (keeps broadcasts and other contacts').
app.delete('/api/push/history', (req, res) => {
  const { contactId } = req.query;
  if (!contactId) return res.status(400).json({ error: 'contactId is required.' });
  for (let i = pushHistory.length - 1; i >= 0; i--) {
    if (!pushHistory[i].all && pushHistory[i].contactId === contactId) pushHistory.splice(i, 1);
  }
  res.json({ ok: true });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, salesforce: configured ? 'configured' : 'not-configured', push: pushReady });
});

// Client-side routing: send the React app for any non-API route.
app.get(/^(?!\/api\/).*/, (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => console.log(`Pronto Eats running on port ${PORT}`));
