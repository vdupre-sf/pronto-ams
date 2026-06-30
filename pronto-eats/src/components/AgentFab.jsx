import { useState } from 'react';

// Placeholder for the AI ordering assistant. The agent isn't built yet — this
// reserves the embed slot and signals the capability to come.
export default function AgentFab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="agent-fab" onClick={() => setOpen((o) => !o)} aria-label="Order with AI">
        <span className="agent-fab-emoji">🤖</span>
        <span className="agent-fab-label">Order with AI</span>
      </button>

      {open && (
        <div className="agent-panel">
          <div className="agent-panel-head">
            <span>🤖 Pronto Assistant</span>
            <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close">✕</button>
          </div>
          <div className="agent-panel-body">
            <div className="agent-bubble">
              Hi! Soon you'll be able to order just by chatting with me —
              “a margherita and a coke from Pizza Pronto,” and I'll handle the rest.
            </div>
            <div className="agent-coming">Coming soon 🚧</div>
          </div>
          <div className="agent-panel-foot">
            <input disabled placeholder="Ask me to order something…" />
            <button className="btn sm" disabled>Send</button>
          </div>
        </div>
      )}
    </>
  );
}
