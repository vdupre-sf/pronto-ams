import { useCallback, useEffect, useState } from 'react';
import {
  enablePush, isStandalone, isIOS, pushSupported,
  notificationPermission, existingSubscription,
  getNotificationHistory, clearNotificationHistory, onPushReceived,
  fetchServerHistory, clearServerHistory,
} from '../pwa.js';

// Short relative time, e.g. "just now", "5m ago", "3h ago", "Tue 14:02".
function relativeTime(ts) {
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = new Date(ts);
  return d.toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

// A bell in the header that lets the user opt into push notifications and
// review past alerts. On iOS, push only works once the app is added to the
// Home Screen, so we guide the user through that first.
export default function NotificationBell({ user }) {
  const [state, setState] = useState('loading'); // loading|unsupported|install-first|default|granted|denied|busy
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState([]);

  // Merge the durable server-side history with the local on-device copy,
  // de-duped by message + minute (the server stamps send-time, the device
  // stamps receive-time — usually within the same minute).
  const refreshHistory = useCallback(async () => {
    const [server, local] = await Promise.all([
      fetchServerHistory(user?.id),
      getNotificationHistory(),
    ]);
    const byKey = new Map();
    for (const n of [...server, ...local]) {
      const key = `${n.title}\n${n.body}\n${Math.round(n.ts / 60000)}`;
      const existing = byKey.get(key);
      // Prefer the earliest timestamp (server send-time) when both exist.
      if (!existing || n.ts < existing.ts) byKey.set(key, { ...existing, ...n, ts: existing ? Math.min(existing.ts, n.ts) : n.ts });
    }
    const merged = [...byKey.values()]
      .map((n, i) => ({ id: n.id ?? `s-${n.ts}-${i}`, ...n }))
      .sort((a, b) => b.ts - a.ts);
    setHistory(merged);
  }, [user?.id]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!pushSupported()) { if (alive) setState(isIOS() ? 'install-first' : 'unsupported'); return; }
      if (isIOS() && !isStandalone()) { if (alive) setState('install-first'); return; }
      const perm = notificationPermission();
      if (perm === 'denied') { if (alive) setState('denied'); return; }
      if (perm === 'granted') {
        const sub = await existingSubscription();
        if (alive) setState(sub ? 'granted' : 'default');
        return;
      }
      if (alive) setState('default');
    })();
    return () => { alive = false; };
  }, []);

  // Keep an unread dot + the list fresh when a push lands while the app is open.
  const [unread, setUnread] = useState(false);
  useEffect(() => onPushReceived(() => {
    refreshHistory();
    setUnread((u) => (open ? u : true));
  }), [open, refreshHistory]);

  // Load history when the popover opens (and clear the unread dot).
  useEffect(() => {
    if (open) { refreshHistory(); setUnread(false); }
  }, [open, refreshHistory]);

  async function onClick() {
    // States that only show guidance/history toggle the popover.
    if (['install-first', 'denied', 'unsupported', 'granted'].includes(state)) {
      setOpen((o) => !o);
      return;
    }
    // 'default' → request permission + subscribe.
    setState('busy');
    try {
      await enablePush(user);
      setState('granted');
      setOpen(true);
    } catch (e) {
      console.warn(e);
      setState(notificationPermission() === 'denied' ? 'denied' : 'default');
      setOpen(true);
    }
  }

  if (state === 'loading' || state === 'unsupported') return null;

  const on = state === 'granted';
  const title = {
    'install-first': 'Add Pronto to your Home Screen to enable notifications',
    default: 'Enable notifications',
    granted: 'Notifications',
    denied: 'Notifications are blocked',
    busy: 'Enabling…',
  }[state] || 'Notifications';

  return (
    <div className="notif-wrap">
      <button
        className={`notif-btn ${on ? 'on' : ''}`}
        onClick={onClick}
        title={title}
        aria-label={title}
      >
        {state === 'busy' ? '…' : on ? '🔔' : '🔕'}
        {on && <span className={`notif-dot ${unread ? 'unread' : ''}`} aria-hidden />}
      </button>

      {open && (
        <>
          <div className="notif-scrim" onClick={() => setOpen(false)} />
          <div className="notif-pop" role="dialog" aria-label="Notifications">
            {state === 'install-first' && (
              <>
                <strong>Get order alerts on your phone</strong>
                <p>To receive notifications on iPhone, add Pronto to your Home Screen first:</p>
                <ol>
                  <li>Tap the <b>Share</b> button (the square with an up-arrow) in Safari</li>
                  <li>Choose <b>Add to Home Screen</b></li>
                  <li>Open <b>Pronto</b> from your Home Screen, then tap the bell again</li>
                </ol>
              </>
            )}
            {state === 'default' && (
              <>
                <strong>Notifications</strong>
                <p>Tap the bell to allow order updates and offers.</p>
              </>
            )}
            {state === 'denied' && (
              <>
                <strong>Notifications are blocked</strong>
                <p>Enable notifications for Pronto in your device Settings, then reload the app.</p>
              </>
            )}
            {state === 'granted' && (
              <>
                <div className="notif-pop-head">
                  <strong>🔔 Notifications</strong>
                  {history.length > 0 && (
                    <button
                      className="notif-clear"
                      onClick={async () => { await Promise.all([clearNotificationHistory(), clearServerHistory(user?.id)]); refreshHistory(); }}
                    >
                      Clear
                    </button>
                  )}
                </div>
                {history.length === 0 ? (
                  <p className="notif-empty">
                    You’re all set — order updates and offers will appear here.
                  </p>
                ) : (
                  <ul className="notif-list">
                    {history.map((n) => (
                      <li key={n.id} className="notif-item">
                        {n.title && <span className="notif-item-title">{n.title}</span>}
                        {n.body && <span className="notif-item-body">{n.body}</span>}
                        <span className="notif-item-time">{relativeTime(n.ts)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
            <button className="notif-pop-close" onClick={() => setOpen(false)}>Done</button>
          </div>
        </>
      )}
    </div>
  );
}
