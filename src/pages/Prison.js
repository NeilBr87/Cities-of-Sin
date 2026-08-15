import React, { useCallback, useEffect, useState } from 'react';
import api from '../api';
import { useGame } from '../state/GameContext';
import { Card, Empty, Loading, Badge, Countdown } from '../components/ui';
import Avatar from '../components/Avatar';
import Chat from '../components/Chat';
import { money, fullName, duration, pct } from '../game/format';
import { rank } from '../game/ranks';
import { CITIES, cityById } from '../game/world';

export default function Prison() {
  const { me, act, refresh } = useGame();
  const [status, setStatus] = useState(null);
  const [cityId, setCityId] = useState(me?.jailCityId || me?.cityId || 'ny');
  const [inmates, setInmates] = useState([]);

  const load = useCallback(() => {
    api.prison.status().then(setStatus).catch(() => setStatus(null));
    api.prison.inmates(cityId).then(setInmates).catch(() => setInmates([]));
  }, [cityId]);
  useEffect(load, [load, me?.jailUntil]);

  if (!me || !status) return <Loading what="Walking the block" />;

  return (
    <>
      <h1>Prison</h1>
      <p className="flavour" style={{ marginTop: -8 }}>
        Sentences are short by design — nobody logs in to wait. Inside, you can still train, still talk,
        and still be got out by someone who wants you out.
      </p>

      {status.inJail ? (
        <Card title={`You are inside — ${cityById(status.cityId)?.name}`}>
          <div className="row" style={{ marginBottom: 14 }}>
            <div className="stat">
              <div className="stat-label">Time left</div>
              <div className="stat-value"><Countdown seconds={status.secondsLeft} onDone={refresh} /></div>
            </div>
            <div className="stat">
              <div className="stat-label">Bail</div>
              <div className="stat-value money">{money(status.bail)}</div>
            </div>
            <button
              className="btn-brass"
              disabled={me.clean < status.bail}
              onClick={() => act(() => api.prison.bail(me.id), 'Paid. Walk out.').then(load)}
            >
              Pay your own bail
            </button>
          </div>

          <h3>Things to do inside</h3>
          <div className="grid grid-4">
            {status.activities.map((a) => (
              <Card key={a.id}>
                <h3 style={{ fontSize: 15 }}>{a.name}</h3>
                <p className="faint tiny">{a.effect}</p>
                <button
                  className="btn-sm btn-block"
                  onClick={() => act(() => api.prison.activity(a.id), (r) => `${a.name}: ${r.effect}`).then(load)}
                >
                  Do it
                </button>
              </Card>
            ))}
          </div>

          <hr />
          <h3>Yard talk</h3>
          <Chat fixedChannel={`prison:${status.cityId}`} />
        </Card>
      ) : (
        <div className="alert">You are not inside. Keep it that way, or get somebody else out.</div>
      )}

      <Card title="The cells">
        <div className="row" style={{ marginBottom: 12 }}>
          {CITIES.map((c) => (
            <button key={c.id} className={`btn-sm ${cityId === c.id ? 'btn-brass' : ''}`} onClick={() => setCityId(c.id)}>
              {c.name}
            </button>
          ))}
        </div>
        {inmates.length === 0 ? <Empty>Nobody in the cells here.</Empty> : inmates.map((i) => (
          <div className="list-row" key={i.id}>
            <Avatar player={i} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div>{fullName(i)} <span className="faint tiny">@{i.username}</span></div>
              <div className="row" style={{ gap: 6, marginTop: 3 }}>
                <Badge kind={i.path}>{rank(i.rankId).label}</Badge>
                <span className="faint tiny">{duration(i.secondsLeft)} left</span>
              </div>
            </div>
            {!status.inJail && String(i.id) !== String(me.id) && (
              <>
                <button
                  className="btn-sm"
                  onClick={() => act(
                    () => api.prison.bust(i.id),
                    (r) => r.success ? 'They are out. That will be remembered.' : `It failed (${pct(r.chance)}) and you are inside now.`
                  ).then(load)}
                >
                  Bust out
                </button>
                <button
                  className="btn-sm"
                  disabled={me.clean < i.bail}
                  onClick={() => act(() => api.prison.bail(i.id), (r) => `Paid ${money(r.cost)}.`).then(load)}
                >
                  Bail ({money(i.bail)})
                </button>
              </>
            )}
          </div>
        ))}
      </Card>
    </>
  );
}
