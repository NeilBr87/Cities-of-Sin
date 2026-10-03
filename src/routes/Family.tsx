import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useCharacter, useSession } from '../state/SessionProvider';
import { Alert, Badge, Card, Empty, Field, Loading, Stat, Tabs } from '../components/ui';
import { money, timeAgo } from '../lib/format';
import { rankOf } from '../lib/ranks';
import type { City, District, FamilyDetail } from '../lib/types';

type Tab = 'members' | 'crews' | 'treasury';

export default function Family() {
  const { character } = useCharacter();
  const { me, act } = useSession();

  const [family, setFamily] = useState<FamilyDetail | null>(null);
  const [districts, setDistricts] = useState<District[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [tab, setTab] = useState<Tab>('members');
  const [busy, setBusy] = useState(false);

  const isBoss = me?.family?.is_boss ?? false;
  const isCaptain = me?.crew?.is_captain ?? false;
  const isMade = ['soldier', 'captain', 'boss'].includes(character.rank_id);

  const load = useCallback(async () => {
    try {
      setFamily(await api.families.get());
    } catch {
      setFamily(null);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    api.world.districts().then(setDistricts).catch(() => setDistricts([]));
    api.world.cities().then(setCities).catch(() => setCities([]));
  }, []);

  /** Every boss/captain action returns the refreshed family, so share one runner. */
  const run = useCallback(async (fn: () => Promise<FamilyDetail>, success: string) => {
    setBusy(true);
    const next = await act(fn, success);
    if (next) setFamily(next);
    setBusy(false);
  }, [act]);

  if (!me?.family) {
    return (
      <>
        <h1>Family</h1>
        <Alert kind="warn">
          You are not with a family. <Link to="/app/families">Find one, or start your own</Link>.
        </Alert>
      </>
    );
  }

  if (!family) return <Loading label="Reading the books" />;

  const openCityIds = new Set(family.cities.map((c) => c.id));
  const takenDistrictIds = new Set(family.crews.map((c) => c.district_id));
  const freeDistricts = districts.filter(
    (d) => openCityIds.has(d.city_id) && !takenDistrictIds.has(d.id),
  );
  const unopenedCities = cities.filter((c) => !openCityIds.has(c.id));

  return (
    <>
      <h1>{family.logo} {family.name}</h1>
      {family.motto && (
        <p className="flavour" style={{ marginTop: -6 }}>“{family.motto}”</p>
      )}

      <div className="row" style={{ marginBottom: 16 }}>
        <Badge kind="mafia">{rankOf(character.rank_id).label}</Badge>
        <Badge>Seat: {family.city}</Badge>
        {family.cities.length > 1 && <Badge>{family.cities.length} cities</Badge>}
        {me.crew && <Badge>{me.crew.name}</Badge>}
      </div>

      <Card>
        <div className="grid grid-4">
          <Stat label="Boss" value={family.boss?.name ?? '—'} />
          <Stat label="Members" value={family.member_count} />
          <Stat label="Crews" value={family.crews.length} />
          <Stat label="Treasury" value={money(family.treasury)} tone="clean" />
        </div>
      </Card>

      <Tabs
        tabs={[
          { id: 'members', label: `Members (${family.members.length})` },
          { id: 'crews', label: `Crews (${family.crews.length})` },
          { id: 'treasury', label: 'Treasury' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'members' && (
        <MembersTab
          family={family}
          viewerId={character.id}
          isBoss={isBoss}
          isCaptain={isCaptain}
          myCrewId={me.crew?.id ?? null}
          busy={busy}
          freeDistricts={freeDistricts}
          run={run}
        />
      )}

      {tab === 'crews' && (
        <CrewsTab
          family={family}
          myCrewId={me.crew?.id ?? null}
          rankId={character.rank_id}
          busy={busy}
          onChanged={load}
        />
      )}

      {tab === 'treasury' && (
        <TreasuryTab
          family={family}
          isBoss={isBoss}
          clean={character.clean}
          unopenedCities={unopenedCities}
          busy={busy}
          run={run}
          onChanged={load}
        />
      )}

      <hr />

      <div className="row">
        {isBoss ? (
          <BossDangerZone family={family} busy={busy} run={run} />
        ) : (
          <>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await act(() => api.families.leave(), 'You are on your own again.');
                setBusy(false);
              }}
            >
              Leave the family
            </button>
            {isMade && (
              <button
                type="button"
                className="btn btn-sm"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const r = await act(() => api.families.voteOutBoss());
                  if (r) {
                    act(async () => r, r.demoted
                      ? 'The vote carried. The family has a new boss.'
                      : `Vote recorded: ${r.votes} of ${r.eligible}. ${r.needed} needed.`);
                    void load();
                  }
                  setBusy(false);
                }}
              >
                Vote out the boss
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}

// ------------------------------------------------------------------ members --

function MembersTab({
  family, viewerId, isBoss, isCaptain, myCrewId, busy, freeDistricts, run,
}: {
  family: FamilyDetail;
  viewerId: string;
  isBoss: boolean;
  isCaptain: boolean;
  myCrewId: string | null;
  busy: boolean;
  freeDistricts: District[];
  run: (fn: () => Promise<FamilyDetail>, success: string) => Promise<void>;
}) {
  // Which soldier is mid-promotion, and to which district.
  const [promoting, setPromoting] = useState<string | null>(null);
  const [districtId, setDistrictId] = useState('');

  return (
    <Card flush>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Name</th><th>Rank</th><th>Crew</th>
              <th className="num">Respect</th><th className="num">Joined</th>
              {(isBoss || isCaptain) && <th />}
            </tr>
          </thead>
          <tbody>
            {family.members.map((m) => {
              const crew = family.crews.find((c) => c.id === m.crew_id);
              const isSelf = m.id === viewerId;
              return (
                <tr key={m.id}>
                  <td>
                    {m.name}
                    {isSelf && <span className="faint tiny"> (you)</span>}
                  </td>
                  <td><Badge kind="mafia">{rankOf(m.rank_id).label}</Badge></td>
                  <td className="dim">{crew?.name ?? '—'}</td>
                  <td className="num">{m.respect.toLocaleString()}</td>
                  <td className="num faint">{m.joined_at ? timeAgo(m.joined_at) : '—'}</td>

                  {(isBoss || isCaptain) && (
                    <td className="right">
                      <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                        {isBoss && m.rank_id === 'associate' && (
                          <button
                            type="button" className="btn btn-sm" disabled={busy}
                            onClick={() => void run(
                              () => api.families.make(m.id),
                              `${m.name} is made.`,
                            )}
                          >
                            Make
                          </button>
                        )}

                        {isBoss && m.rank_id === 'soldier' && (
                          promoting === m.id ? (
                            <>
                              <select
                                value={districtId}
                                onChange={(e) => setDistrictId(e.target.value)}
                                style={{ width: 'auto', minWidth: 160 }}
                              >
                                <option value="">Pick a district…</option>
                                {freeDistricts.map((d) => (
                                  <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                              </select>
                              <button
                                type="button" className="btn btn-sm btn-primary"
                                disabled={busy || !districtId}
                                onClick={async () => {
                                  await run(
                                    () => api.families.promote(m.id, districtId),
                                    `${m.name} has a crew.`,
                                  );
                                  setPromoting(null);
                                  setDistrictId('');
                                }}
                              >
                                Give crew
                              </button>
                              <button
                                type="button" className="btn btn-sm btn-ghost"
                                onClick={() => setPromoting(null)}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              type="button" className="btn btn-sm" disabled={busy}
                              onClick={() => setPromoting(m.id)}
                            >
                              Promote
                            </button>
                          )
                        )}

                        {isBoss && m.rank_id === 'captain' && (
                          <button
                            type="button" className="btn btn-sm" disabled={busy}
                            onClick={() => void run(
                              () => api.families.demote(m.id),
                              `${m.name} is back to soldier.`,
                            )}
                          >
                            Take crew
                          </button>
                        )}

                        {isCaptain && !isBoss && m.crew_id === myCrewId && !isSelf && (
                          <button
                            type="button" className="btn btn-sm btn-danger" disabled={busy}
                            onClick={() => void run(
                              () => api.families.kickFromCrew(m.id),
                              `${m.name} is out of the crew.`,
                            )}
                          >
                            Drop
                          </button>
                        )}

                        {isBoss && !isSelf && (
                          <button
                            type="button" className="btn btn-sm btn-danger" disabled={busy}
                            onClick={() => void run(
                              () => api.families.kick(m.id),
                              `${m.name} is out.`,
                            )}
                          >
                            Kick
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isBoss && (
        <p className="tiny faint" style={{ padding: '10px 16px', margin: 0 }}>
          Associates kick up nothing and are owed nothing. Make them and they start
          paying ten percent a week — to their captain if they have one, otherwise
          straight to you.
        </p>
      )}
    </Card>
  );
}

// -------------------------------------------------------------------- crews --

function CrewsTab({
  family, myCrewId, rankId, busy, onChanged,
}: {
  family: FamilyDetail;
  myCrewId: string | null;
  rankId: string;
  busy: boolean;
  onChanged: () => void;
}) {
  const { act } = useSession();
  const canJoin = rankId === 'soldier' || rankId === 'associate';

  if (family.crews.length === 0) {
    return (
      <Empty>
        No crews yet. The boss makes a captain, and a captain comes with a district.
      </Empty>
    );
  }

  return (
    <div className="grid grid-2">
      {family.crews.map((c) => {
        const mine = c.id === myCrewId;
        return (
          <Card
            key={c.id}
            title={c.name}
            action={
              mine ? (
                rankId !== 'captain' && (
                  <button
                    type="button" className="btn btn-sm btn-ghost" disabled={busy}
                    onClick={async () => {
                      await act(() => api.families.leaveCrew(), 'You are crewless.');
                      onChanged();
                    }}
                  >
                    Leave
                  </button>
                )
              ) : canJoin && (
                <button
                  type="button" className="btn btn-sm" disabled={busy}
                  onClick={async () => {
                    await act(() => api.families.joinCrew(c.id), `You are with the ${c.name}.`);
                    onChanged();
                  }}
                >
                  Join
                </button>
              )
            }
          >
            <div className="grid grid-3">
              <Stat label="Captain" value={c.captain.name} />
              <Stat label="District" value={c.district} />
              <Stat label="Strength" value={c.size} />
            </div>
            {mine && <Alert kind="good">This is your crew.</Alert>}
          </Card>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------- treasury --

function TreasuryTab({
  family, isBoss, clean, unopenedCities, busy, run, onChanged,
}: {
  family: FamilyDetail;
  isBoss: boolean;
  clean: number;
  unopenedCities: City[];
  busy: boolean;
  run: (fn: () => Promise<FamilyDetail>, success: string) => Promise<void>;
  onChanged: () => void;
}) {
  const { act } = useSession();
  const [deposit, setDeposit] = useState('');
  const [withdraw, setWithdraw] = useState('');

  const dep = Number(deposit) || 0;
  const wd = Number(withdraw) || 0;

  async function submitDeposit(e: FormEvent) {
    e.preventDefault();
    await act(() => api.families.deposit(dep), `${money(dep)} into the pot.`);
    setDeposit('');
    onChanged();
  }

  return (
    <div className="grid grid-2">
      <Card title="The pot">
        <Stat label="Treasury" value={money(family.treasury)} tone="clean" />
        <p className="tiny dim" style={{ marginTop: 10 }}>
          Family money, separate from anyone's pocket. It pays for opening new
          cities, and later for rackets and war. Anyone can put money in; only the
          boss takes it out.
        </p>

        <hr />

        <form onSubmit={submitDeposit}>
          <Field label="Put in clean money">
            <input
              type="number" min={1} max={clean} value={deposit}
              onChange={(e) => setDeposit(e.target.value)} placeholder="0"
            />
          </Field>
          {dep > clean && (
            <div className="field-error" style={{ marginTop: -8, marginBottom: 10 }}>
              You only have {money(clean)} clean.
            </div>
          )}
          <button
            type="submit" className="btn btn-block"
            disabled={busy || dep <= 0 || dep > clean}
          >
            Contribute
          </button>
        </form>

        {isBoss && (
          <>
            <hr />
            <Field label="Take out">
              <input
                type="number" min={1} max={family.treasury} value={withdraw}
                onChange={(e) => setWithdraw(e.target.value)} placeholder="0"
              />
            </Field>
            <button
              type="button" className="btn btn-block"
              disabled={busy || wd <= 0 || wd > family.treasury}
              onClick={async () => {
                await act(() => api.families.withdraw(wd), `${money(wd)} out of the pot.`);
                setWithdraw('');
                onChanged();
              }}
            >
              Withdraw
            </button>
          </>
        )}
      </Card>

      <Card title="Where you operate">
        <div className="row" style={{ marginBottom: 12 }}>
          {family.cities.map((c) => <Badge key={c.id} kind="mafia">{c.name}</Badge>)}
        </div>
        <p className="tiny dim">
          You can only recruit, and only place crews, in cities you have opened.
          One crew per district, however many cities you hold.
        </p>

        {isBoss && unopenedCities.length > 0 && (
          <>
            <hr />
            <div className="label" style={{ marginBottom: 8 }}>Open a new city</div>
            <div className="col">
              {unopenedCities.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="btn btn-block"
                  disabled={busy}
                  onClick={() => void run(
                    () => api.families.expand(c.id),
                    `The family is open in ${c.name}.`,
                  )}
                >
                  Open {c.name}
                </button>
              ))}
            </div>
            <p className="tiny faint" style={{ marginTop: 10, marginBottom: 0 }}>
              Paid from the treasury, not your pocket.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}

// ------------------------------------------------------------- danger zone --

function BossDangerZone({
  family, busy, run,
}: {
  family: FamilyDetail;
  busy: boolean;
  run: (fn: () => Promise<FamilyDetail>, success: string) => Promise<void>;
}) {
  const { act } = useSession();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(family.name);
  const [motto, setMotto] = useState(family.motto);
  const [logo, setLogo] = useState(family.logo);
  const [confirmDisband, setConfirmDisband] = useState(false);

  return (
    <div style={{ width: '100%' }}>
      <div className="row">
        <button
          type="button" className="btn btn-sm"
          onClick={() => setEditing((e) => !e)}
        >
          {editing ? 'Never mind' : 'Edit family'}
        </button>
        <button
          type="button" className="btn btn-sm btn-danger" disabled={busy}
          onClick={() => setConfirmDisband(true)}
        >
          Disband
        </button>
      </div>

      {editing && (
        <Card className="card" title="Family details">
          <div className="grid grid-3">
            <Field label="Name">
              <input type="text" value={name} maxLength={32} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Logo">
              <input type="text" value={logo} maxLength={8} onChange={(e) => setLogo(e.target.value)} />
            </Field>
            <Field label="Motto">
              <input type="text" value={motto} maxLength={120} onChange={(e) => setMotto(e.target.value)} />
            </Field>
          </div>
          <button
            type="button" className="btn btn-primary"
            disabled={busy || name.trim().length < 3}
            onClick={async () => {
              await run(() => api.families.update(name, motto, logo), 'Saved.');
              setEditing(false);
            }}
          >
            Save
          </button>
        </Card>
      )}

      {confirmDisband && (
        <Card className="card">
          <Alert kind="error">
            Disbanding turns every member back into an unattached hoodlum, deletes
            every crew, and gives the seat back to the city. The treasury
            ({money(family.treasury)}) is gone. This cannot be undone.
          </Alert>
          <div className="row">
            <button
              type="button" className="btn btn-danger" disabled={busy}
              onClick={async () => {
                await act(() => api.families.disband(), 'It is finished.');
              }}
            >
              Yes, disband the {family.name} family
            </button>
            <button
              type="button" className="btn btn-ghost"
              onClick={() => setConfirmDisband(false)}
            >
              Cancel
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
