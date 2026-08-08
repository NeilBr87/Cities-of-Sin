import React, { useCallback, useEffect, useState } from 'react';
import api from '../api';
import { useGame } from '../state/GameContext';
import { Card, Field, Empty, Loading, Badge, ConfirmButton, Tabs } from '../components/ui';
import { rank } from '../game/ranks';
import { money, fullName } from '../game/format';
import { CONFIG } from '../game/economy';

/** The family you are in: roster, crews, treasury, hits, and boss controls. */
export default function Family() {
  const { me, act } = useGame();
  const [tab, setTab] = useState('roster');
  const [members, setMembers] = useState(null);
  const [crews, setCrews] = useState([]);
  const [hits, setHits] = useState([]);
  const [edit, setEdit] = useState(null);
  const [bounty, setBounty] = useState(CONFIG.ASSASSINATION_CONTRACT_MIN);
  const [targetName, setTargetName] = useState('');
  const [found, setFound] = useState([]);

  const familyId = me?.familyId;
  const isBoss = me?.family && String(me.family.bossId) === String(me.id);
  const isCaptain = me?.rankId === 'captain';

  const load = useCallback(() => {
    if (!familyId) return;
    api.families.members(familyId).then(setMembers).catch(() => setMembers([]));
    api.crews.ofFamily(familyId).then(setCrews).catch(() => setCrews([]));
    api.hits.list().then(setHits).catch(() => setHits([]));
  }, [familyId]);

  useEffect(load, [load]);

  if (!me?.familyId) {
    return (
      <>
        <h1>No Family</h1>
        <Card>
          <Empty>
            You are unattached. Sign on with one of the five families, or found your own if a seat is open.
          </Empty>
        </Card>
      </>
    );
  }

  const fam = me.family;

  return (
    <>
      <h1>{fam.logo} {fam.name} Family</h1>
      <p className="flavour" style={{ marginTop: -8 }}>{fam.motto || 'No motto. Yet.'}</p>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'roster', label: 'Roster' },
          { id: 'crews', label: 'Crews' },
          ...(isBoss ? [{ id: 'admin', label: 'Boss controls' }] : []),
          { id: 'hits', label: 'Contracts' },
        ]}
      />

      {tab === 'roster' && (
        <Card title={`Members (${members?.length ?? '…'})`}>
          {members === null ? <Loading /> : members.map((m) => (
            <div className="list-row" key={m.id}>
              <div style={{ flex: 1 }}>
                <div>{fullName(m)} <span className="faint tiny">@{m.username}</span></div>
                <div className="row" style={{ gap: 6, marginTop: 3 }}>
                  <Badge kind="mafia">{rank(m.rankId).label}</Badge>
                  <span className="faint tiny">{m.respect} respect</span>
                  {m.jailUntil && <Badge kind="jail">inside</Badge>}
                </div>
              </div>
              {isBoss && String(m.id) !== String(me.id) && (
                <div className="row" style={{ gap: 5 }}>
                  {m.rankId === 'associate' && (
                    <button
                      className="btn-sm"
                      disabled={m.respect < CONFIG.MADE_MIN_RESPECT}
                      title={m.respect < CONFIG.MADE_MIN_RESPECT ? `Needs ${CONFIG.MADE_MIN_RESPECT} respect` : ''}
                      onClick={() => act(() => api.families.makeMember(m.id), 'Made.').then(load)}
                    >Make</button>
                  )}
                  {m.rankId === 'soldier' && (
                    <button className="btn-sm" onClick={() => act(() => api.families.promote(m.id, 'captain'), 'Promoted to captain.').then(load)}>
                      Promote
                    </button>
                  )}
                  {['soldier', 'captain'].includes(m.rankId) && (
                    <button className="btn-sm" onClick={() => act(() => api.families.demote(m.id), 'Demoted.').then(load)}>
                      Demote
                    </button>
                  )}
                  <ConfirmButton className="btn-sm" onConfirm={() => act(() => api.families.kick(m.id), 'Out.').then(load)}>
                    Kick
                  </ConfirmButton>
                </div>
              )}
            </div>
          ))}

          {!isBoss && (
            <>
              <hr />
              <div className="row-between">
                <span className="faint tiny">
                  A strict majority of the family can vote the boss down to soldier.
                </span>
                <ConfirmButton
                  className="btn-sm"
                  confirmLabel="Cast the vote?"
                  onConfirm={() => act(
                    () => api.families.voteOutBoss(),
                    (r) => r.deposed ? 'The boss is finished.' : `Vote cast: ${r.votes}/${r.needed}.`
                  ).then(load)}
                >
                  Vote against the boss
                </ConfirmButton>
              </div>
            </>
          )}
        </Card>
      )}

      {tab === 'crews' && (
        <>
          <div className="grid grid-2">
            {crews.length === 0 && <Empty>No crews yet. The boss promotes a soldier to captain to start one.</Empty>}
            {crews.map((c) => (
              <Card key={c.id} title={c.name}>
                <p className="faint tiny" style={{ marginTop: 0 }}>
                  Captain: {c.captain ? fullName(c.captain) : 'vacant'} · {c.size} member(s)
                </p>
                {['soldier', 'associate'].includes(me.rankId) && String(me.crewId) !== String(c.id) && (
                  <button className="btn-sm" onClick={() => act(() => api.crews.join(c.id), `Joined the ${c.name}.`).then(load)}>
                    Join this crew
                  </button>
                )}
                {String(me.crewId) === String(c.id) && me.rankId !== 'captain' && (
                  <button className="btn-sm" onClick={() => act(() => api.crews.leave(), 'Left the crew.').then(load)}>
                    Leave
                  </button>
                )}
              </Card>
            ))}
          </div>
          <Card title="How the money moves">
            <p className="faint tiny" style={{ marginBottom: 0 }}>
              Every week, soldiers kick {CONFIG.KICK_UP_PCT * 100}% up to their captain — or straight to the boss if
              they are not in a crew. Captains keep what they collect, then kick {CONFIG.KICK_UP_PCT * 100}% of their own
              total to the boss. Associates{CONFIG.ASSOCIATES_KICK_UP ? ' also kick up' : ' pay nothing, and are owed nothing'}.
            </p>
          </Card>
        </>
      )}

      {tab === 'admin' && isBoss && (
        <Card title="Family details">
          <div className="grid grid-2">
            <Field label="Name">
              <input defaultValue={fam.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} maxLength={CONFIG.FAMILY_NAME_MAX} />
            </Field>
            <Field label="Logo (any character or emoji)">
              <input defaultValue={fam.logo} onChange={(e) => setEdit({ ...edit, logo: e.target.value })} maxLength={4} />
            </Field>
          </div>
          <Field label="Motto">
            <input defaultValue={fam.motto} onChange={(e) => setEdit({ ...edit, motto: e.target.value })} maxLength={80} />
          </Field>
          <Field label="Colour">
            <input type="color" defaultValue={fam.colour} onChange={(e) => setEdit({ ...edit, colour: e.target.value })} />
          </Field>
          <div className="row">
            <button className="btn-brass" disabled={!edit} onClick={() => act(() => api.families.update(fam.id, edit), 'Family updated.')}>
              Save
            </button>
            <div className="spacer" />
            <ConfirmButton
              className="btn-primary"
              confirmLabel="Disband the family for good?"
              onConfirm={() => act(() => api.families.disband(fam.id), 'The family is gone.')}
            >
              Disband
            </ConfirmButton>
          </div>
        </Card>
      )}

      {tab === 'hits' && (
        <>
          {isBoss && (
            <Card title="Order a hit">
              <p className="faint tiny" style={{ marginTop: 0 }}>
                The bounty comes out of the family treasury. You assign a captain; the captain picks the shooter
                from their own crew.
              </p>
              <div className="grid grid-2">
                <Field label="Find a target">
                  <input
                    value={targetName}
                    onChange={async (e) => {
                      setTargetName(e.target.value);
                      if (e.target.value.length >= 2) setFound(await api.player.search(e.target.value));
                      else setFound([]);
                    }}
                    placeholder="username or name"
                  />
                </Field>
                <Field label={`Bounty (min ${money(CONFIG.ASSASSINATION_CONTRACT_MIN)})`}>
                  <input type="number" value={bounty} onChange={(e) => setBounty(Number(e.target.value))} />
                </Field>
              </div>
              {found.slice(0, 6).map((f) => (
                <div className="list-row" key={f.id}>
                  <div style={{ flex: 1 }}>{fullName(f)} <span className="faint tiny">@{f.username} · {rank(f.rankId).label}</span></div>
                  <button className="btn-sm" onClick={() => act(() => api.hits.order(f.id, bounty), 'Contract opened.').then(load)}>
                    Put out the contract
                  </button>
                </div>
              ))}
            </Card>
          )}

          <Card title="Open contracts">
            {hits.length === 0 ? <Empty>No open contracts.</Empty> : hits.map((h) => (
              <div className="list-row" key={h.id}>
                <div style={{ flex: 1 }}>
                  <div>Target: <strong>{h.target ? fullName(h.target) : 'unknown'}</strong> — {money(h.bounty)}</div>
                  <div className="faint tiny">
                    Captain: {h.captain ? fullName(h.captain) : 'unassigned'} ·
                    Shooter: {h.shooter ? fullName(h.shooter) : 'unassigned'}
                  </div>
                </div>
                {isBoss && !h.captainId && (
                  <select
                    style={{ width: 180 }}
                    defaultValue=""
                    onChange={(e) => e.target.value && act(() => api.hits.assignCaptain(h.id, e.target.value), 'Assigned.').then(load)}
                  >
                    <option value="">Assign a captain…</option>
                    {(members || []).filter((m) => m.rankId === 'captain').map((m) => (
                      <option key={m.id} value={m.id}>{fullName(m)}</option>
                    ))}
                  </select>
                )}
                {isCaptain && String(h.captainId) === String(me.id) && !h.shooterId && (
                  <button className="btn-sm" onClick={() => act(() => api.hits.assignShooter(h.id, me.id), 'You are taking this one yourself.').then(load)}>
                    Take it myself
                  </button>
                )}
                {String(h.shooterId) === String(me.id) && (
                  <button className="btn-primary btn-sm" onClick={() => act(
                    () => api.hits.execute(h.id),
                    (r) => r.success ? 'Done. Collect the bounty.' : 'It went wrong. You are hurt.'
                  ).then(load)}>
                    Execute
                  </button>
                )}
              </div>
            ))}
          </Card>
        </>
      )}
    </>
  );
}
