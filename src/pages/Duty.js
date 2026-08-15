import React, { useCallback, useEffect, useState } from 'react';
import api from '../api';
import { useGame } from '../state/GameContext';
import { Card, Empty, Loading, Badge, Countdown } from '../components/ui';
import Avatar from '../components/Avatar';
import { POLICE_ACTIONS } from '../game/crimes';
import { money, fullName, pct } from '../game/format';
import { CONFIG } from '../game/economy';
import { districtById } from '../game/world';
import { rank, PATHS } from '../game/ranks';

/** The police work screen: investigate, arrest, extort. */
export default function Duty() {
  const { me, act } = useGame();
  const [wanted, setWanted] = useState([]);
  const [cases, setCases] = useState([]);
  const [cooldowns, setCooldowns] = useState({});
  const [last, setLast] = useState(null);

  const load = useCallback(() => {
    if (!me) return;
    api.police.wanted(me.districtId).then(setWanted).catch(() => setWanted([]));
    api.police.cases().then(setCases).catch(() => setCases([]));
  }, [me]);
  useEffect(load, [load]);

  if (!me) return <Loading />;
  if (me.path !== PATHS.POLICE) {
    return <Card><Empty>You are not police. This screen is for people with a badge.</Empty></Card>;
  }

  const district = districtById(me.districtId);

  async function doAction(a) {
    const res = await act(() => api.police.action(a.id));
    if (res) {
      setLast({ action: a, res });
      setCooldowns({ ...cooldowns, [a.id]: a.cooldownSec });
      load();
    }
  }

  return (
    <>
      <h1>Duty — {district?.name}</h1>
      <p className="flavour" style={{ marginTop: -8 }}>
        Salary is steady and small. Arrests pay bonuses that scale with the suspect's heat and rank.
        What you take on the side is between you and whoever is counting.
      </p>

      {!me.departmentId && (
        <div className="alert">
          You are unassigned. Join a department on the <a href="#/police">Police</a> page — a rookie
          becomes an officer the moment they do.
        </div>
      )}

      {last && (
        <div className="alert good">
          <strong>{last.action.name}</strong> — {last.res.dirty ? 'pocketed' : 'earned'} {money(last.res.pay)}
          {last.res.leads > 0 && `, ${last.res.leads} lead(s) developed`}.
          {last.res.suspects?.length > 0 && (
            <span className="faint"> Names surfaced: {last.res.suspects.map((s) => s.username).join(', ')}.</span>
          )}
        </div>
      )}

      <div className="grid grid-2">
        {POLICE_ACTIONS.map((a) => (
          <Card key={a.id}>
            <div className="card-header">
              <h3>{a.name}</h3>
              <span className={`mono ${a.dirty ? 'money-dirty' : 'money-clean'}`}>{money(a.pay)}</span>
            </div>
            <p className="flavour" style={{ marginTop: 0 }}>{a.flavour}</p>
            <div className="row tiny muted" style={{ marginBottom: 10 }}>
              <span>Nerve <strong className="mono">{a.nerve}</strong></span>
              {a.dirty && <Badge kind="mafia">Pays dirty</Badge>}
            </div>
            <button
              className="btn-block"
              disabled={me.nerve < a.nerve || cooldowns[a.id] > 0 || me.jailSecondsLeft > 0}
              onClick={() => doAction(a)}
            >
              {cooldowns[a.id] > 0
                ? <>Wait <Countdown seconds={cooldowns[a.id]} onDone={() => setCooldowns({ ...cooldowns, [a.id]: 0 })} /></>
                : me.nerve < a.nerve ? 'Not enough nerve' : 'Work it'}
            </button>
          </Card>
        ))}
      </div>

      <Card title={`Wanted in ${district?.name}`}>
        <p className="faint tiny" style={{ marginTop: 0 }}>
          You can move to arrest at {CONFIG.HEAT_ARREST_THRESHOLD} heat or above. Below that, build the case first.
        </p>
        {wanted.length === 0 ? <Empty>Nobody hot enough to touch. Investigate and raise some heat.</Empty> : wanted.map((w) => (
          <div className="list-row" key={w.id}>
            <Avatar player={w} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div>{fullName(w)} <span className="faint tiny">@{w.username}</span></div>
              <div className="row" style={{ gap: 6, marginTop: 3 }}>
                <Badge kind={w.path}>{rank(w.rankId).label}</Badge>
                <span className="danger tiny">Heat {w.heat}</span>
              </div>
            </div>
            <button
              className="btn-primary btn-sm"
              disabled={me.jailSecondsLeft > 0}
              onClick={() => act(
                () => api.police.arrest(w.id),
                (r) => r.success
                  ? `Arrested. Bonus ${money(r.bonus)}, sentence ${Math.round(r.sentenceSeconds / 60)}m.`
                  : `They got away. Odds were ${pct(r.chance)}.`
              ).then(load)}
            >
              Arrest
            </button>
          </div>
        ))}
      </Card>

      <Card title="Case file">
        {cases.length === 0 ? <Empty>No open cases in this district.</Empty> : cases.slice(0, 20).map((c) => (
          <div className="list-row" key={c.id}>
            <div style={{ flex: 1 }}>
              <div>{c.crimeId?.replace(/_/g, ' ')} — {c.suspect ? fullName(c.suspect) : 'unknown suspect'}</div>
              <div className="faint tiny">{c.evidence} evidence · {c.solved ? 'worked' : 'open'}</div>
            </div>
            {c.solved && <Badge kind="police">Closed</Badge>}
          </div>
        ))}
      </Card>
    </>
  );
}
