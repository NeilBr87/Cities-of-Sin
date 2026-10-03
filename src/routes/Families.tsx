import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useCharacter, useSession } from '../state/SessionProvider';
import { Alert, Card, Empty, Field, Loading } from '../components/ui';
import { money, timeAgo } from '../lib/format';
import type { FamilyListing } from '../lib/types';

export default function Families() {
  const { character, city } = useCharacter();
  const { me, act } = useSession();

  const [listing, setListing] = useState<FamilyListing | null>(null);
  const [showFound, setShowFound] = useState(false);
  const [name, setName] = useState('');
  const [motto, setMotto] = useState('');
  const [logo, setLogo] = useState('🎩');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setListing(await api.families.list(city.id));
    } catch {
      setListing(null);
    }
  }, [city.id]);

  useEffect(() => { void load(); }, [load]);

  if (character.path !== 'mafia') {
    return (
      <>
        <h1>Families</h1>
        <Alert kind="warn">
          Families are a mafia concern. You chose {character.path}, so this is a
          spectator sport — though knowing who runs what is still worth your time.
        </Alert>
        <FamilyTable listing={listing} />
      </>
    );
  }

  if (me?.family) {
    return (
      <>
        <h1>Families</h1>
        <Alert>
          You are with the {me.family.logo} <strong>{me.family.name}</strong> family.{' '}
          <Link to="/app/family">Go to your family</Link>.
        </Alert>
        <FamilyTable listing={listing} />
      </>
    );
  }

  if (!listing) return <Loading label="Asking around" />;

  const seatsTaken = listing.families.length;
  const seatsLeft = Math.max(0, listing.seats_per_city - seatsTaken);
  const canAfford = character.clean >= listing.founding_cost;

  async function found(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const ok = await act(
      () => api.families.found(name, motto, logo),
      (f) => `The ${f.name} family is yours.`,
    );
    setBusy(false);
    if (ok) { setShowFound(false); void load(); }
  }

  async function join(id: string) {
    setBusy(true);
    await act(() => api.families.join(id), 'You are in. Associate, for now.');
    setBusy(false);
    void load();
  }

  return (
    <>
      <h1>Families of {city.name}</h1>
      <p className="flavour" style={{ marginTop: -6 }}>
        Five seats to a city, first come first served. There is no sixth.
      </p>

      <Card
        title={`${seatsTaken} of ${listing.seats_per_city} seats taken`}
        action={
          seatsLeft > 0 && (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => setShowFound((s) => !s)}
            >
              {showFound ? 'Never mind' : 'Start a family'}
            </button>
          )
        }
      >
        {seatsLeft === 0 ? (
          <p className="dim" style={{ margin: 0 }}>
            Every seat in {city.name} is spoken for. You can join one of them, or
            fly somewhere with room and start your own there.
          </p>
        ) : (
          <p className="dim" style={{ margin: 0 }}>
            {seatsLeft} {seatsLeft === 1 ? 'seat' : 'seats'} left. Starting a family
            costs <strong>{money(listing.founding_cost)}</strong> in clean money and
            makes you its boss.
          </p>
        )}

        {showFound && (
          <form onSubmit={found} style={{ marginTop: 16 }}>
            <hr />
            <div className="grid grid-3">
              <Field label="Family name" hint="3–32 characters. Claimed globally.">
                <input
                  type="text" value={name} maxLength={32} required minLength={3}
                  onChange={(e) => setName(e.target.value)} placeholder="Genovese"
                />
              </Field>
              <Field label="Logo" hint="One or two emoji.">
                <input
                  type="text" value={logo} maxLength={8}
                  onChange={(e) => setLogo(e.target.value)} placeholder="🎩"
                />
              </Field>
              <Field label="Motto" hint="Optional. 120 characters.">
                <input
                  type="text" value={motto} maxLength={120}
                  onChange={(e) => setMotto(e.target.value)}
                  placeholder="This thing of ours"
                />
              </Field>
            </div>

            {!canAfford && (
              <Alert kind="error">
                You have {money(character.clean)} clean. You need{' '}
                {money(listing.founding_cost)}.
              </Alert>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={busy || !canAfford || name.trim().length < 3}
              style={{ marginTop: 10 }}
            >
              Found the family — {money(listing.founding_cost)}
            </button>
          </form>
        )}
      </Card>

      {listing.families.length === 0 && (
        <Empty>Nobody runs anything in {city.name}. That is an opportunity.</Empty>
      )}

      <div className="grid grid-2">
        {listing.families.map((f) => (
          <Card
            key={f.id}
            title={<span>{f.logo} {f.name}</span>}
            action={
              <button
                type="button"
                className="btn btn-sm"
                disabled={busy}
                onClick={() => void join(f.id)}
              >
                Ask to join
              </button>
            }
          >
            {f.motto && <p className="flavour" style={{ marginTop: 0 }}>“{f.motto}”</p>}
            <div className="grid grid-3">
              <div className="stat">
                <div className="stat-label">Boss</div>
                <div style={{ fontSize: 14 }}>{f.boss ?? <span className="faint">Vacant</span>}</div>
              </div>
              <div className="stat">
                <div className="stat-label">Made up of</div>
                <div className="stat-value" style={{ fontSize: 15 }}>{f.member_count}</div>
              </div>
              <div className="stat">
                <div className="stat-label">Crews</div>
                <div className="stat-value" style={{ fontSize: 15 }}>{f.crew_count}</div>
              </div>
            </div>
            <p className="tiny faint" style={{ marginTop: 10, marginBottom: 0 }}>
              Founded {timeAgo(f.founded_at)}. You would come in as an associate —
              inside, but not made.
            </p>
          </Card>
        ))}
      </div>
    </>
  );
}

/** Read-only roster, for players who cannot join one. */
function FamilyTable({ listing }: { listing: FamilyListing | null }) {
  if (!listing) return <Loading />;
  if (listing.families.length === 0) return <Empty>Nobody runs anything here yet.</Empty>;

  return (
    <Card flush>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Family</th><th>Boss</th>
              <th className="num">Members</th><th className="num">Crews</th>
            </tr>
          </thead>
          <tbody>
            {listing.families.map((f) => (
              <tr key={f.id}>
                <td>{f.logo} {f.name}</td>
                <td className="dim">{f.boss ?? '—'}</td>
                <td className="num">{f.member_count}</td>
                <td className="num">{f.crew_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
