import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useCharacter, useSession } from '../state/SessionProvider';
import { Alert, Badge, Card, Empty, Loading, Stat, Tabs } from '../components/ui';
import { duration, money, pct } from '../lib/format';
import type { CityMap, RacketListing, TakeoverResult } from '../lib/types';

type Tab = 'district' | 'map';

export default function Rackets() {
  const { character, city } = useCharacter();
  const { me, act } = useSession();

  const [listing, setListing] = useState<RacketListing | null>(null);
  const [map, setMap] = useState<CityMap | null>(null);
  const [tab, setTab] = useState<Tab>('district');
  const [last, setLast] = useState<TakeoverResult | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  // Local clock so grace timers count down without re-fetching every second.
  const [, tick] = useState(0);

  const load = useCallback(async () => {
    try {
      setListing(await api.rackets.list());
    } catch {
      setListing(null);
    }
  }, []);

  useEffect(() => { void load(); }, [load, character.district_id]);

  useEffect(() => {
    if (tab !== 'map') return;
    api.rackets.map().then(setMap).catch(() => setMap(null));
  }, [tab, city.id]);

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (character.path !== 'mafia') {
    return (
      <>
        <h1>Rackets</h1>
        <Alert kind="warn">
          Rackets are family business. You chose {character.path} — you can see who
          holds what, but you cannot take any of it.
        </Alert>
        {listing && <ControlPanel listing={listing} />}
      </>
    );
  }

  if (!listing) return <Loading label="Counting the doors" />;

  const { district, backup, can_act, is_boss_or_captain, nerve_cost, treasury } = listing;

  async function take(id: string) {
    setPending(id);
    const r = await act(() => api.rackets.take(id));
    setPending(null);
    if (r) { setLast(r); setListing(r.rackets); }
  }

  async function buy(id: string) {
    setPending(id);
    const next = await act(() => api.rackets.buy(id), 'Bought. It is yours on paper now.');
    setPending(null);
    if (next) setListing(next);
  }

  return (
    <>
      <h1>Rackets</h1>
      <p className="flavour" style={{ marginTop: -6 }}>
        A district is the businesses in it. Hold more of them than anyone else and
        the district is yours.
      </p>

      {!me?.family && (
        <Alert kind="warn">
          You need a family before any of this is worth anything.{' '}
          <Link to="/app/families">Find one</Link>.
        </Alert>
      )}

      {me?.family && !can_act && (
        <Alert kind="warn">
          You have to be made before you can move on a racket. Earn respect and
          ask your boss.
        </Alert>
      )}

      {last && (
        <Card title={last.success ? 'It is yours' : 'It held'}>
          <div className="grid grid-4">
            <Stat label="Racket" value={last.racket} />
            <Stat label="Odds were" value={pct(last.chance)} />
            <Stat label="Your backup" value={last.backup} />
            <Stat label="Theirs" value={last.defenders} />
          </div>
          {!last.success && (
            <Alert kind="error">
              You came off worse. Heat up {last.heat_gained}, and it cost you blood.
              Bring more people next time.
            </Alert>
          )}
        </Card>
      )}

      <Tabs
        tabs={[
          { id: 'district', label: district.name },
          { id: 'map', label: `${city.name} map` },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'map' ? (
        <MapTab map={map} />
      ) : (
        <>
          <ControlPanel listing={listing} />

          <Card
            title="The doors in this district"
            action={
              <span className="tiny faint">
                Backup here: <strong className="mono">{backup}</strong>
                {treasury !== null && <> · Treasury <strong className="mono">{money(treasury)}</strong></>}
              </span>
            }
            flush
          >
            {listing.rackets.length === 0 && <Empty>Nothing worth taking.</Empty>}

            {listing.rackets.map((r) => {
              const grace = Math.max(0, r.grace_seconds);
              const cooling = grace > 0;
              const blocked = !can_act || cooling || r.mine || character.nerve < nerve_cost;
              const canBuy = is_boss_or_captain && !r.owner_family_id
                && treasury !== null && treasury >= r.price;

              return (
                <div className="crime" key={r.id}>
                  <div>
                    <div className="crime-name">
                      {r.name}{' '}
                      {r.mine && <Badge kind="good">Yours</Badge>}
                      {!r.owner_family_id && <Badge>Open</Badge>}
                    </div>
                    <div className="flavour" style={{ fontSize: 13 }}>{r.blurb}</div>
                    <div className="crime-meta">
                      <span className="faint">
                        Held by <b>{r.owner ? `${r.owner.logo} ${r.owner.name}` : 'nobody'}</b>
                      </span>
                      {r.owner_crew && <span className="faint">Crew <b>{r.owner_crew}</b></span>}
                      <span className="faint">Pays <b style={{ color: 'var(--clean)' }}>{money(r.income)}/wk</b></span>
                      <span className="faint">Defence <b>{r.defence}/10</b></span>
                      {r.owner_family_id && <span className="faint">On the ground <b>{r.defenders}</b></span>}
                    </div>
                  </div>

                  <div className="crime-act">
                    {!r.mine && (
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        disabled={blocked || pending === r.id}
                        onClick={() => void take(r.id)}
                      >
                        {pending === r.id ? 'Going…' : `Take — ${pct(r.chance)}`}
                      </button>
                    )}
                    {canBuy && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={pending === r.id}
                        onClick={() => void buy(r.id)}
                      >
                        Buy — {money(r.price)}
                      </button>
                    )}
                    {!r.owner_family_id && !canBuy && is_boss_or_captain && (
                      <span className="tiny faint">Treasury short of {money(r.price)}</span>
                    )}
                    {cooling && <span className="tiny faint mono">{duration(grace)}</span>}
                    {!cooling && can_act && character.nerve < nerve_cost && !r.mine && (
                      <span className="tiny faint">Needs {nerve_cost} nerve</span>
                    )}
                  </div>
                </div>
              );
            })}

            <p className="tiny faint" style={{ padding: '10px 16px', margin: 0 }}>
              Every family member standing in this district adds to your odds, and
              every one of theirs subtracts. Taking a door is a crew job — move
              people in first.
            </p>
          </Card>
        </>
      )}
    </>
  );
}

// ------------------------------------------------------------------ control --

function ControlPanel({ listing }: { listing: RacketListing }) {
  const { control, district } = listing;

  return (
    <Card title={`Control of ${district.name}`}>
      {control.standings.length === 0 ? (
        <Empty>Nobody holds a single door here. All of it is open.</Empty>
      ) : (
        <>
          <div className="row" style={{ marginBottom: 12 }}>
            {control.contested ? (
              <Badge kind="hot">Contested</Badge>
            ) : control.family_id ? (
              <Badge kind="good">
                {control.standings[0]?.logo} {control.standings[0]?.name} controls it
              </Badge>
            ) : (
              <Badge>Uncontrolled</Badge>
            )}
            <span className="tiny faint">
              {control.held} of {control.total} doors
            </span>
          </div>

          <div className="col" style={{ gap: 8 }}>
            {control.standings.map((s) => (
              <div key={s.family_id}>
                <div className="between tiny" style={{ marginBottom: 3 }}>
                  <span>{s.logo} {s.name}</span>
                  <span className="mono faint">{s.held}/{control.total}</span>
                </div>
                <div className="meter">
                  <span style={{ width: `${(s.held / Math.max(1, control.total)) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>

          {control.contested && (
            <p className="tiny faint" style={{ marginTop: 10, marginBottom: 0 }}>
              Level at the top means nobody controls it. One more door breaks the tie.
            </p>
          )}
        </>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------- map --

function MapTab({ map }: { map: CityMap | null }) {
  if (!map) return <Loading label="Drawing the map" />;

  return (
    <div className="grid grid-2">
      {map.districts.map((d) => {
        const c = d.control;
        const leader = c.standings[0];
        return (
          <Card
            key={d.id}
            title={
              <span>
                {d.name} {d.here && <Badge kind="good">You are here</Badge>}
              </span>
            }
          >
            <div className="row" style={{ marginBottom: 10 }}>
              {c.contested ? (
                <Badge kind="hot">Contested</Badge>
              ) : c.family_id && leader ? (
                <Badge kind="mafia">{leader.logo} {leader.name}</Badge>
              ) : (
                <Badge>Open</Badge>
              )}
              <span className="tiny faint mono">
                {c.standings.reduce((n, s) => n + s.held, 0)}/{c.total} doors held
              </span>
            </div>

            <div className="grid grid-2">
              <Stat label="Wealth" value={`${d.wealth.toFixed(2)}×`} />
              <Stat label="Policing" value={`${d.policing.toFixed(2)}×`} />
            </div>

            {c.standings.length > 0 && (
              <>
                <hr />
                <div className="col" style={{ gap: 6 }}>
                  {c.standings.map((s) => (
                    <div className="between tiny" key={s.family_id}>
                      <span>{s.logo} {s.name}</span>
                      <span className="mono faint">{s.held}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        );
      })}
    </div>
  );
}
