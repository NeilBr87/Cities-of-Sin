import React, { useState } from 'react';
import api from '../api';
import { useGame } from '../state/GameContext';
import { Card, Field, Alert } from '../components/ui';
import { CITIES } from '../game/world';
import { PATHS, PATH_META } from '../game/ranks';
import { fullName } from '../game/format';

export default function CreateCharacter() {
  const { refresh, signOut } = useGame();
  const [form, setForm] = useState({
    firstName: '', lastName: '', nickname: '',
    cityId: 'ny', path: PATHS.MAFIA, bio: '',
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.player.createCharacter(form);
      await refresh();
    } catch (err) {
      setError(err.message || 'Could not create your character.');
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 620 }}>
        <div className="auth-title">Who Are You</div>
        <div className="auth-sub">Name yourself. It is the only thing nobody can take.</div>

        <Card>
          <Alert kind="error">{error}</Alert>

          <form onSubmit={submit}>
            <div className="grid grid-3">
              <Field label="First name"><input value={form.firstName} onChange={set('firstName')} maxLength={20} /></Field>
              <Field label="Nickname"><input value={form.nickname} onChange={set('nickname')} maxLength={20} placeholder="The Boy" /></Field>
              <Field label="Last name"><input value={form.lastName} onChange={set('lastName')} maxLength={20} /></Field>
            </div>

            <div className="alert" style={{ marginTop: 0 }}>
              You will be known as <strong>{fullName(form) || '…'}</strong>
              {form.lastName && form.path === PATHS.MAFIA && (
                <span className="faint"> — and if you ever make captain, your crew takes your surname: the {form.lastName} Crew.</span>
              )}
            </div>

            <Field label="Starting city">
              <select value={form.cityId} onChange={set('cityId')}>
                {CITIES.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.tagline}</option>)}
              </select>
            </Field>

            <label>Your line of work</label>
            <div className="grid grid-3" style={{ marginBottom: 14 }}>
              {Object.values(PATH_META).map((p) => (
                <div
                  key={p.id}
                  className="card"
                  onClick={() => setForm({ ...form, path: p.id })}
                  style={{
                    cursor: 'pointer',
                    borderColor: form.path === p.id ? 'var(--brass)' : 'var(--border)',
                    background: form.path === p.id ? 'var(--panel-2)' : 'var(--panel)',
                    padding: 13,
                  }}
                >
                  <h3 style={{ marginBottom: 5 }}>{p.label}</h3>
                  <div className="faint tiny">{p.blurb}</div>
                </div>
              ))}
            </div>

            <Field label="Bio (optional)">
              <textarea value={form.bio} onChange={set('bio')} rows={3} maxLength={400} />
            </Field>

            <button className="btn-brass btn-block" disabled={busy} type="submit">
              {busy ? 'Signing you in…' : 'Begin'}
            </button>
          </form>
        </Card>

        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button className="btn-ghost btn-sm" onClick={signOut}>Sign out</button>
        </div>
      </div>
    </div>
  );
}
