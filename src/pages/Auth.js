import React, { useState } from 'react';
import { useGame } from '../state/GameContext';
import { Card, Field, Alert } from '../components/ui';
import { ERA } from '../game/era';

export default function Auth({ initialMode = 'login', onBack }) {
  const { signIn } = useGame();
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({ username: '', password: '', email: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(form, mode === 'signup');
    } catch (err) {
      setError(err.message || 'Could not sign you in.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-title">Cities of Sin</div>
        <div className="auth-sub">{ERA.label} · {ERA.year}</div>

        <Card>
          <p className="flavour" style={{ marginTop: 0 }}>{ERA.blurb}</p>
          <hr />

          <div className="tabs">
            <div className={`tab ${mode === 'login' ? 'active' : ''}`} onClick={() => setMode('login')}>Sign in</div>
            <div className={`tab ${mode === 'signup' ? 'active' : ''}`} onClick={() => setMode('signup')}>New arrival</div>
          </div>

          <Alert kind="error">{error}</Alert>

          <form onSubmit={submit}>
            <Field label="Username">
              <input value={form.username} onChange={set('username')} autoComplete="username" autoFocus />
            </Field>
            {mode === 'signup' && (
              <Field label="Email (optional)">
                <input value={form.email} onChange={set('email')} type="email" autoComplete="email" />
              </Field>
            )}
            <Field label="Password">
              <input
                value={form.password}
                onChange={set('password')}
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
            </Field>
            <button className="btn-brass btn-block" disabled={busy} type="submit">
              {busy ? 'One moment…' : mode === 'signup' ? 'Step off the bus' : 'Sign in'}
            </button>
          </form>
        </Card>

        <p className="faint tiny" style={{ textAlign: 'center', marginTop: 14 }}>
          Four cities. Three ways up. Five family seats in each.
        </p>
        {onBack && (
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <button className="btn-ghost btn-sm" onClick={onBack}>Back to the front page</button>
          </div>
        )}
      </div>
    </div>
  );
}
