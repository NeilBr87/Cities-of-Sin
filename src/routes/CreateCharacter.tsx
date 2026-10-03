import { useEffect, useState, type FormEvent } from 'react';
import api from '../lib/api';
import { useSession } from '../state/SessionProvider';
import { Alert, Field, Loading } from '../components/ui';
import { PATHS } from '../lib/ranks';
import type { City, LifePath } from '../lib/types';

export default function CreateCharacter() {
  const { me, act, signOut } = useSession();
  const [cities, setCities] = useState<City[] | null>(null);

  const [firstName, setFirstName] = useState('');
  const [nickname, setNickname] = useState('');
  const [lastName, setLastName] = useState('');
  const [path, setPath] = useState<LifePath | null>(null);
  const [cityId, setCityId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.world.cities().then(setCities).catch(() => setCities([]));
  }, []);

  const preview = [firstName, nickname ? `'${nickname}'` : '', lastName]
    .filter(Boolean)
    .join(' ')
    .trim();

  const ready = firstName.length >= 2 && lastName.length >= 2 && path && cityId;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready || !path || !cityId) return;
    setBusy(true);
    await act(
      () => api.player.create({ firstName, lastName, nickname: nickname || null, path, cityId }),
      'Welcome to the life.',
    );
    setBusy(false);
  }

  if (!cities) return <Loading label="Loading the world" />;

  return (
    <div className="auth-wrap">
      <div className="auth-box wide">
        <div className="auth-head">
          <div className="brand-mark">Cities of <span>Sin</span></div>
          <p>
            Signed in as {me?.profile.username}. You get one character at a time —
            make it count.
          </p>
        </div>

        <form onSubmit={submit}>
          <div className="card">
            <div className="card-header"><h3>Your name</h3></div>

            <div className="grid grid-3">
              <Field label="First name">
                <input
                  type="text" value={firstName} maxLength={16} required
                  onChange={(e) => setFirstName(e.target.value)} placeholder="Johnny"
                />
              </Field>
              <Field label="Nickname" hint="Optional">
                <input
                  type="text" value={nickname} maxLength={20}
                  onChange={(e) => setNickname(e.target.value)} placeholder="The Boy"
                />
              </Field>
              <Field label="Surname">
                <input
                  type="text" value={lastName} maxLength={16} required
                  onChange={(e) => setLastName(e.target.value)} placeholder="Smith"
                />
              </Field>
            </div>

            {preview && (
              <div className="flavour" style={{ fontSize: 22, color: 'var(--brass)' }}>
                {preview}
              </div>
            )}
            <p className="faint tiny" style={{ marginTop: 6, marginBottom: 0 }}>
              If you make captain, your crew takes your surname. Choose one you can live with.
            </p>
          </div>

          <div className="card">
            <div className="card-header"><h3>Your line of work</h3></div>
            <div className="picker cols-3">
              {Object.values(PATHS).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`pick ${path === p.id ? 'on' : ''}`}
                  onClick={() => setPath(p.id)}
                  aria-pressed={path === p.id}
                >
                  <h4>{p.label}</h4>
                  <div className="pick-tag">{p.tagline}</div>
                  <p>{p.blurb}</p>
                </button>
              ))}
            </div>
            <p className="faint tiny" style={{ marginTop: 10, marginBottom: 0 }}>
              This is permanent for this character. You can only change it by starting over.
            </p>
          </div>

          <div className="card">
            <div className="card-header"><h3>Where you get off the bus</h3></div>
            <div className="picker cols-2">
              {cities.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`pick ${cityId === c.id ? 'on' : ''}`}
                  onClick={() => setCityId(c.id)}
                  aria-pressed={cityId === c.id}
                >
                  <h4>{c.name}</h4>
                  <div className="pick-tag">{c.tagline}</div>
                  <p>{c.signature_blurb}</p>
                </button>
              ))}
            </div>
          </div>

          {!ready && (
            <Alert kind="warn">
              Pick a name of at least two letters, a path, and a city.
            </Alert>
          )}

          <div className="row" style={{ marginTop: 16 }}>
            <button type="submit" className="btn btn-primary btn-lg grow" disabled={!ready || busy}>
              {busy ? 'Getting off the bus…' : 'Start living'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
