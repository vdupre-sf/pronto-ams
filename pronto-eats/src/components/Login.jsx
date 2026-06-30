import { useState } from 'react';
import { login } from '../api.js';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    setStatus('busy');
    try {
      const { user } = await login(email);
      onLogin(user);
    } catch (err) {
      setError(err.message);
      setStatus('idle');
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <aside className="login-brand">
          <div className="logo-badge"><img src="/pronto-logo.png" alt="Pronto" /></div>
          <div className="login-brand-body">
            <h2>Hungry?<br />Pronto's got you.</h2>
            <p>Order from your favourite local restaurants — delivered fast.</p>
            <ul className="login-perks">
              <li><span className="ico">🍕</span> 20 restaurants, hundreds of dishes</li>
              <li><span className="ico">🛵</span> Fresh, fast delivery</li>
              <li><span className="ico">🤖</span> Order with our AI assistant <em>(soon)</em></li>
            </ul>
          </div>
        </aside>

        <div className="login-form-panel">
          <h1>Sign in</h1>
          <p className="sub">Enter the email on your account to continue.</p>

          <form onSubmit={submit} className="login-form">
            <label>
              Email
              <input
                type="email" required autoFocus placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            {error && <div className="errbox">{error}</div>}

            <button className="btn" type="submit" disabled={status === 'busy'}>
              {status === 'busy' ? 'Signing in…' : 'Continue'}
            </button>
          </form>

          <p className="login-hint">
            Demo: use any contact in the org.{' '}
            <button type="button" className="linklike" onClick={() => setEmail('daan.jansen2@example.com')}>
              Try daan.jansen2@example.com
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
