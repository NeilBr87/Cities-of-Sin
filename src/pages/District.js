import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useGame } from '../state/GameContext';
import { Card, Empty, Loading, Badge, Stat, ConfirmButton } from '../components/ui';
import { fullName, money } from '../game/format';
import { rank } from '../game/ranks';
import { districtsOf, cityById } from '../game/world';
import { CONFIG } from '../game/economy';

export default function District() {
  const { me, act } = useGame();
  const [view, setView] = useState(me?.districtId);
  const [data, setData] = useState(null);

  const load = useCallback(() => {
    if (!view) return;
    api.territory.district(view).then(setData).catch(() => setData(null));
  }, [view]);
  useEffect(load, [load]);
  useEffect(() => { setView(me?.districtId); }, [me?.districtId]);

  if (!me) return <Loading />;
  const city = cityById(me.cityId);
  const here = String(view) === String(me.districtId);
  const warSet = new Set((me.warTargets || []).map(String));

  return (
    <>
      <h1>{city?.name}</h1>
      <p className="flavour" style={{ marginTop: -8 }}>{city?.signatureBlurb}</p>

      <div className="row" style={{ marginBottom: 16 }}>
        {districtsOf(me.cityId).map((d) => (
          <button
            key={d.id}
            className={`btn-sm ${String(view) === String(d.id) ? 'btn-brass' : ''}`}
            onClick={() => setView(d.id)}
          >
            {d.name}
          </button>
        ))}
      </div>

      {!data ? <Loading /> : (
        <>
          <Card
            title={data.name}
            action={!here && (
              <button className="btn-sm" onClick={() => act(() => api.player.moveDistrict(data.id), `Moved to ${data.name}.`)}>
                Move here
              </button>
            )}
          >
            <div className="grid grid-4">
              <Stat label="Wealth" value={`×${data.wealth}`} sub="crime and racket payouts" />
              <Stat label="Policing" value={`×${data.policing}`} sub="heat and arrests" />
              <Stat label="Open cases" value={data.openCases} />
              <Stat label="On the street" value={data.playersHere?.length ?? 0} />
            </div>
            <hr />
            <p className="tiny muted" style={{ marginBottom: 4 }}>
              Signature contract here: <strong>{data.contracts}</strong>
            </p>
            <p className="tiny muted" style={{ margin: 0 }}>
              Councilman: <strong>{data.councilman ? fullName(data.councilman) : 'vacant'}</strong>
              {data.department && <> · Police: <strong>{data.department.name}</strong></>}
            </p>
          </Card>

          <div className="grid grid-2">
            <Card
              title="Who runs this district"
              action={<Link to="/rackets" className="btn btn-sm">Work the rackets</Link>}
            >
              <p className="faint tiny" style={{ marginTop: 0 }}>
                Control goes to whoever holds the most rackets here. A tie leaves it contested
                and under nobody.
              </p>
              {data.control?.contested && (
                <div className="alert" style={{ marginBottom: 12 }}>
                  <strong>Contested.</strong> Nobody controls this district — one racket decides it.
                </div>
              )}
              {!data.control?.standings?.length ? <Empty>Nobody holds anything here.</Empty> : (
                data.control.standings.map((s) => {
                  const isController = String(s.familyId) === String(data.control.familyId);
                  return (
                    <div key={s.familyId} style={{ marginBottom: 10 }}>
                      <div className="row-between tiny">
                        <span style={{ color: s.family?.colour }}>
                          {s.family?.logo} {s.family?.name || 'Unknown'}
                          {isController && <strong className="faint"> — controls</strong>}
                        </span>
                        <span className="mono">{s.count} / {data.rackets?.length ?? 0}</span>
                      </div>
                      <div className="meter">
                        <span style={{
                          width: `${(s.count / Math.max(1, data.rackets?.length ?? 1)) * 100}%`,
                          background: s.family?.colour || 'var(--brass)',
                        }} />
                      </div>
                    </div>
                  );
                })
              )}

              {data.crews?.length > 0 && (
                <>
                  <hr />
                  <p className="tiny muted" style={{ marginBottom: 6 }}>Crews planted here</p>
                  {data.crews.map((c) => (
                    <div className="list-row" key={c.id}>
                      <div style={{ flex: 1 }}>
                        <div>{c.name}</div>
                        <div className="faint tiny" style={{ color: c.family?.colour }}>
                          {c.family?.name} · {c.size} member(s)
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </Card>

            <Card title="Rackets on this block">
              {!data.rackets?.length ? <Empty>Nothing here.</Empty> : data.rackets.map((r) => (
                <div className="list-row" key={r.racketId}>
                  <div style={{ flex: 1 }}>
                    <div>{r.name}</div>
                    <div className="faint tiny">
                      {r.ownerFamily
                        ? <span style={{ color: r.ownerFamily.colour }}>{r.ownerFamily.name}</span>
                        : <span className="money-clean">unclaimed</span>}
                      {' · '}{money(r.income)}/wk
                    </div>
                  </div>
                  <Badge>{r.label}</Badge>
                </div>
              ))}
            </Card>
          </div>

          <Card title="Who is out here">
            {!data.playersHere?.length ? <Empty>The street is empty.</Empty> : data.playersHere.slice(0, 30).map((p) => {
              const atWar = p.familyId && warSet.has(String(p.familyId));
              const madeTarget = rank(p.rankId).level >= rank('soldier').level;
              const canKill = here && atWar && madeTarget
                && rank(me.rankId).level >= rank('soldier').level
                && String(p.id) !== String(me.id);
              return (
                <div className="list-row" key={p.id}>
                  <div style={{ flex: 1 }}>
                    <div>{fullName(p)} <span className="faint tiny">@{p.username}</span></div>
                    <div className="row" style={{ gap: 6, marginTop: 3 }}>
                      <Badge kind={p.path}>{rank(p.rankId).label}</Badge>
                      {atWar && <Badge kind="mafia">At war</Badge>}
                      {p.heat >= CONFIG.HEAT_ARREST_THRESHOLD && <span className="danger tiny">Heat {p.heat}</span>}
                    </div>
                  </div>
                  {here && String(p.id) !== String(me.id) && (
                    <button
                      className="btn-sm"
                      onClick={() => act(
                        () => api.combat.attack(p.id),
                        (r) => r.win ? `You won. Took ${money(r.stolen)}.` : 'You lost that one.'
                      )}
                    >
                      Attack
                    </button>
                  )}
                  {canKill && (
                    <ConfirmButton
                      className="btn-primary btn-sm"
                      confirmLabel="Kill them?"
                      onConfirm={() => act(
                        () => api.combat.assassinate(p.id),
                        (r) => r.message
                      )}
                    >
                      Assassinate
                    </ConfirmButton>
                  )}
                </div>
              );
            })}
            {(me.warTargets || []).length > 0 && (
              <p className="faint tiny" style={{ marginTop: 10, marginBottom: 0 }}>
                Your family is at war. Made men on both sides can kill each other here without
                a contract — and it is permanent.
              </p>
            )}
          </Card>
        </>
      )}
    </>
  );
}
