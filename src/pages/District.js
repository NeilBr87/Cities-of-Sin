import React, { useCallback, useEffect, useState } from 'react';
import api from '../api';
import { useGame } from '../state/GameContext';
import { Card, Empty, Loading, Badge, Stat } from '../components/ui';
import { fullName } from '../game/format';
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
              <Stat label="Wealth" value={`×${data.wealth}`} sub="crime payouts" />
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
            <Card title="Family dominance">
              <p className="faint tiny" style={{ marginTop: 0 }}>
                Every successful crime here pushes your family's number up. It decays if nobody works the
                district. Past {CONFIG.DOMINANCE_CAPTURE_THRESHOLD} you hold it outright.
              </p>
              {!data.dominance?.length ? <Empty>Nobody has a foothold.</Empty> : data.dominance.map((d) => (
                <div key={d.id} style={{ marginBottom: 10 }}>
                  <div className="row-between tiny">
                    <span style={{ color: d.family?.colour }}>{d.family?.logo} {d.family?.name || 'Unknown'}</span>
                    <span className="mono">{d.points}</span>
                  </div>
                  <div className="meter">
                    <span style={{ width: `${d.points}%`, background: d.family?.colour || 'var(--brass)' }} />
                  </div>
                </div>
              ))}
            </Card>

            <Card title="Who is out here">
              {!data.playersHere?.length ? <Empty>The street is empty.</Empty> : data.playersHere.slice(0, 25).map((p) => (
                <div className="list-row" key={p.id}>
                  <div style={{ flex: 1 }}>
                    <div>{fullName(p)} <span className="faint tiny">@{p.username}</span></div>
                    <div className="row" style={{ gap: 6, marginTop: 3 }}>
                      <Badge kind={p.path}>{rank(p.rankId).label}</Badge>
                      {p.heat >= CONFIG.HEAT_ARREST_THRESHOLD && <span className="danger tiny">Heat {p.heat}</span>}
                    </div>
                  </div>
                  {here && String(p.id) !== String(me.id) && (
                    <button
                      className="btn-sm"
                      onClick={() => act(
                        () => api.combat.attack(p.id),
                        (r) => r.win ? `You won. Took $${r.stolen.toLocaleString()}.` : 'You lost that one.'
                      )}
                    >
                      Attack
                    </button>
                  )}
                </div>
              ))}
            </Card>
          </div>
        </>
      )}
    </>
  );
}
