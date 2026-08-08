import React, { useCallback, useEffect, useState } from 'react';
import api from '../api';
import { useGame } from '../state/GameContext';
import { Card, Field, Empty, Loading, Badge, ConfirmButton, Tabs } from '../components/ui';
import { money, fullName, timeAgo } from '../game/format';
import { DIPLOMACY, DIPLOMACY_META, PROPOSABLE, diplomacyMeta } from '../game/diplomacy';
import { cityById } from '../game/world';

export default function Diplomacy() {
  const { me, act } = useGame();
  const [tab, setTab] = useState('board');
  const [data, setData] = useState(null);
  const [mine, setMine] = useState([]);
  const [peace, setPeace] = useState({ familyId: null, money: 0, racketIds: [] });

  const load = useCallback(() => {
    api.diplomacy.overview().then(setData).catch(() => setData(null));
    api.rackets.mine().then(setMine).catch(() => setMine([]));
  }, []);
  useEffect(load, [load]);

  if (!me) return <Loading />;
  if (!me.familyId) {
    return (
      <>
        <h1>Diplomacy</h1>
        <Card><Empty>You need a family before anybody will take your calls.</Empty></Card>
      </>
    );
  }

  const isBoss = me.family && String(me.family.bossId) === String(me.id);
  if (!data) return <Loading what="Making calls" />;

  const atWarWith = data.relations.find((r) => r.state === DIPLOMACY.WAR);

  return (
    <>
      <h1>Diplomacy</h1>
      <p className="flavour" style={{ marginTop: -8 }}>
        A pact, a war and an alliance are one family each. Everything else is neutral, and
        neutral means everybody can rob everybody.
      </p>

      {!isBoss && (
        <div className="alert">
          Only the boss makes and answers offers. This is the board as it stands — worth
          knowing who you are allowed to touch.
        </div>
      )}

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'board', label: 'The board' },
          ...(isBoss ? [{ id: 'inbox', label: `Inbox${data.inbox.length ? ` (${data.inbox.length})` : ''}` }] : []),
          ...(isBoss && atWarWith ? [{ id: 'peace', label: 'Sue for peace' }] : []),
        ]}
      />

      {tab === 'board' && (
        <>
          {data.relations.length > 0 && (
            <Card title="Where you stand">
              {data.relations.map((r) => {
                const m = diplomacyMeta(r.state);
                return (
                  <div className="list-row" key={r.id}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: r.family?.colour }}>
                        {r.family?.logo} {r.family?.name}
                      </div>
                      <div className="faint tiny">Since {timeAgo(r.since)}</div>
                    </div>
                    <span className="badge" style={{ color: m.colour, borderColor: m.colour }}>
                      {m.label}
                    </span>
                    {isBoss && r.state !== DIPLOMACY.WAR && (
                      <ConfirmButton
                        className="btn-sm"
                        onConfirm={() => act(() => api.diplomacy.end(r.family.id), 'Arrangement ended.').then(load)}
                      >
                        End it
                      </ConfirmButton>
                    )}
                  </div>
                );
              })}
              {data.warTargets?.length > 0 && (
                <p className="faint tiny" style={{ marginTop: 10, marginBottom: 0 }}>
                  Your soldiers may kill freely against:{' '}
                  <strong className="danger">{data.warTargets.map((f) => f.name).join(', ')}</strong>
                  {' '}— including any war inherited from an ally.
                </p>
              )}
            </Card>
          )}

          <Card title="Every other family">
            {data.families.map((f) => {
              const m = diplomacyMeta(f.state);
              return (
                <div className="list-row" key={f.id}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: f.colour }}>{f.logo} {f.name}</div>
                    <div className="faint tiny">
                      {cityById(f.cityId)?.name} · {f.memberCount} members · {f.racketCount} rackets
                      {f.boss ? ` · boss ${fullName(f.boss)}` : ' · no boss'}
                    </div>
                  </div>
                  <span className="badge" style={{ color: m.colour, borderColor: m.colour }}>{m.short}</span>
                  {isBoss && f.state === DIPLOMACY.NEUTRAL && (
                    <select
                      style={{ width: 190 }}
                      defaultValue=""
                      onChange={(e) => {
                        if (!e.target.value) return;
                        const state = e.target.value;
                        e.target.value = '';
                        act(
                          () => api.diplomacy.propose(f.id, state),
                          (r) => r.requiresConsent
                            ? `Offer sent to the ${f.name} boss.`
                            : `You are at war with the ${f.name} family.`
                        ).then(load);
                      }}
                    >
                      <option value="">Propose…</option>
                      {PROPOSABLE.map((s) => (
                        <option key={s} value={s}>
                          {DIPLOMACY_META[s].label}{DIPLOMACY_META[s].requiresConsent ? '' : ' (no reply needed)'}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })}
          </Card>

          <Card title="The rules">
            {Object.values(DIPLOMACY_META).map((m) => (
              <div className="list-row" key={m.id}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: m.colour }}>{m.label}</div>
                  <div className="faint tiny">{m.blurb}</div>
                </div>
                <Badge>{m.exclusive ? 'One family' : 'Any number'}</Badge>
              </div>
            ))}
          </Card>
        </>
      )}

      {tab === 'inbox' && isBoss && (
        <>
          <Card title="On your desk">
            {data.inbox.length === 0 ? <Empty>Nothing waiting.</Empty> : data.inbox.map((m) => (
              <div className="list-row" key={m.id}>
                <div style={{ flex: 1 }}>
                  <div>
                    <strong>{m.fromFamily?.name}</strong>
                    {m.type === 'proposal' && ` proposes ${diplomacyMeta(m.payload.state).label.toLowerCase()}`}
                    {m.type === 'declaration' && ' has gone to the mattresses with you'}
                    {m.type === 'peace' && ' is offering terms'}
                    {m.type === 'notice' && ` — ${m.payload.text}`}
                  </div>
                  <div className="faint tiny">
                    {timeAgo(m.at)}
                    {m.type === 'peace' && ` · ${money(m.payload.money)} and ${m.payload.racketIds?.length || 0} racket(s)`}
                  </div>
                </div>
                {['proposal', 'peace'].includes(m.type) ? (
                  <>
                    <button
                      className="btn-brass btn-sm"
                      onClick={() => act(() => api.diplomacy.respond(m.id, true), 'Agreed.').then(load)}
                    >
                      Accept
                    </button>
                    <button
                      className="btn-sm"
                      onClick={() => act(() => api.diplomacy.respond(m.id, false), 'Declined.').then(load)}
                    >
                      Decline
                    </button>
                  </>
                ) : (
                  <button className="btn-sm" onClick={() => act(() => api.diplomacy.respond(m.id, false), 'Noted.').then(load)}>
                    Dismiss
                  </button>
                )}
              </div>
            ))}
          </Card>

          {data.sent?.length > 0 && (
            <Card title="Awaiting an answer">
              {data.sent.map((m) => (
                <div className="list-row" key={m.id}>
                  <div style={{ flex: 1 }}>
                    <div>{m.toFamily?.name}</div>
                    <div className="faint tiny">
                      {m.type === 'peace' ? 'Peace terms' : diplomacyMeta(m.payload?.state).label} · sent {timeAgo(m.at)}
                    </div>
                  </div>
                  <Badge>Pending</Badge>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {tab === 'peace' && isBoss && atWarWith && (
        <Card title={`Terms for the ${atWarWith.family?.name} family`}>
          <p className="faint tiny" style={{ marginTop: 0 }}>
            A war does not end because you would like it to. Offer something worth taking —
            money out of your treasury, rackets off your map, or both. If they accept, you
            both go back to neutral and the transfers happen immediately.
          </p>
          <Field label="Money from the treasury">
            <input
              type="number"
              value={peace.money}
              onChange={(e) => setPeace({ ...peace, money: Number(e.target.value) })}
            />
          </Field>
          <label>Rackets to hand over</label>
          <div style={{ marginBottom: 14 }}>
            {mine.length === 0 ? <Empty>You hold no rackets to give.</Empty> : mine.map((r) => (
              <div className="list-row" key={r.racketId}>
                <label style={{ flex: 1, textTransform: 'none', letterSpacing: 0, fontSize: 14, color: 'var(--ink)', marginBottom: 0 }}>
                  <input
                    type="checkbox"
                    style={{ width: 'auto', marginRight: 8 }}
                    checked={peace.racketIds.includes(r.racketId)}
                    onChange={(e) => setPeace({
                      ...peace,
                      racketIds: e.target.checked
                        ? [...peace.racketIds, r.racketId]
                        : peace.racketIds.filter((x) => x !== r.racketId),
                    })}
                  />
                  {r.name}
                </label>
                <span className="mono money-dirty tiny">{money(r.income)}/wk</span>
              </div>
            ))}
          </div>
          <button
            className="btn-brass"
            onClick={() => act(
              () => api.diplomacy.offerPeace(atWarWith.family.id, peace.money, peace.racketIds),
              'Terms sent. Now you wait.'
            ).then(load)}
          >
            Send the offer
          </button>
        </Card>
      )}
    </>
  );
}
