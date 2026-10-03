import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { Alert, Field } from '../components/ui';

export default function Auth({ mode }: { mode: 'signup' | 'signin' }) {
  const navigate = useNavigate();
  const isSignup = mode === 'signup';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (isSignup) {
        await api.auth.signUp(email, password, username);
        // With email confirmation on, there is no session yet — say so rather
        // than dropping the player on a blank screen.
        setNotice('Check your email and click the link to confirm. Then sign in.');
      } else {
        await api.auth.signIn(email, password);
        navigate('/app', { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-box">
        <div className="auth-head">
          <Link to="/" className="brand-mark" style={{ borderBottom: 0, display: 'block' }}>
            Cities of <span>Sin</span>
          </Link>
          <p>{isSignup ? 'Pick a handle. You get one.' : 'Back to work.'}</p>
        </div>

        {notice ? (
          <div className="card stack">
            <Alert kind="good">{notice}</Alert>
            <Link to="/signin" className="btn btn-primary btn-block">Go to sign in</Link>
          </div>
        ) : (
          <form className="card" onSubmit={submit}>
            {isSignup && (
              <Field
                label="Username"
                hint="3–20 characters, letters, numbers and underscores. This is your account, not your character's name."
              >
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                  minLength={3}
                  maxLength={20}
                  pattern="[A-Za-z0-9_]+"
                />
              </Field>
            )}

            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </Field>

            <Field label="Password" hint={isSignup ? 'At least eight characters.' : undefined}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                required
                minLength={8}
              />
            </Field>

            {error && <Alert kind="error">{error}</Alert>}

            <button type="submit" className="btn btn-primary btn-block" disabled={busy} style={{ marginTop: 14 }}>
              {busy ? 'Working…' : isSignup ? 'Create account' : 'Sign in'}
            </button>
          </form>
        )}

        <p className="auth-alt" style={{ marginTop: 16 }}>
          {isSignup ? (
            <>Already have one? <Link to="/signin">Sign in</Link></>
          ) : (
            <>New here? <Link to="/signup">Start a character</Link></>
          )}
        </p>
      </div>
    </div>
  );
}
