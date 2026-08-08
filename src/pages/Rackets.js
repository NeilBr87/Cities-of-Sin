import React, { useCallback, useEffect, useState } from 'react';
import api from '../api';
import { useGame } from '../state/GameContext';
import { Card, Loading, Badge, Stat } from '../components/ui';
import { money, pct } from '../game/format';
import { districtsOf, districtById, cityById } from '../game/world';
import { CONFIG } from '../game/economy';

export default function Rackets() {
  const { me, act } = useGame();
  const [districtId, setDistrictId] = useState(me?.districtId);
  const [data, setData] = useState(null);
  const [mine, setMine] = useState([]);
  const [result, setResult] = useState(null);

  const load = useCallback(() => {
    if (districtId) api.rackets.ofDistrict(districtId).then(setData).catch(() => setData(null));
    api.rackets.mine().then(setMine).catch(() => setMine([]));
  }, [districtId]);
  useEffect(load, [load]);
  useEffect(() => { setDistrictId(me?.districtId); }, [me?.districtId]);

  if (!me) return <Loading />;

  const here = String(districtId) === String(me.districtId);
  const weeklyTake = mine.reduce((s, r) => s + (r.income || 0), 0);

  return (
    <>
      <h1>Rackets</h1>
      <p className="flavour" style={{ marginTop: -8 }}>
        A district is not a score. It is a list of businesses, and whoever holds the most of
        them owns the place. Buy what nobody has claimed. Take what somebody has.
      </p>

      {result && (
        <div className={`alert ${result.success ? 'good' : 'error'}`}>
          <strong>{result.message}</strong>
          <span className="faint">
            {' '}Odds were {pct(result.chance)} with a crew of {result.crewSize} against {result.defenders} defender(s).
          </span>
        </div>
      )}

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <Stat label="Rackets held" value={mine.length} sub="by your family" />
        <Stat label="Weekly take" value={money(weeklyTake)} tone="dirty" sub="paid dirty, every week" />
        <Stat label="Your crew" value={me.crew ? me.crew.name : 'None'} sub={me.crew ? 'backing you up' : 'you are on your own'} />
      </div>

      <div className="row" style={{ marginBottom: 14 }}>
        {districtsOf(me.cityId).map((d) => (
          <button
            key={d.id}
            className={`btn-sm ${String(districtId) === String(d.id) ? 'btn-brass' : ''}`}
            onClick={() => setDistrictId(d.id)}
          >
            {d.name}
          </button>
        ))}
      </div>

      {!data ? <Loading what="Walking the block" /> : (
        <>
          <Card title={`${data.district.name} — who runs it`}>
            {data.control.contested ? (
              <p className="muted" style={{ marginTop: 0 }}>
                <strong>Contested.</strong> Two families hold the same number of rackets here,
                so nobody controls it. One more racket settles it.
              </p>
            ) : data.control.familyId ? (
              <p className="muted" style={{ marginTop: 0 }}>
                Controlled with <strong>{data.control.count}</strong> of{' '}
                {data.rackets.length} rackets.
              </p>
            ) : (
              <p className="muted" style={{ marginTop: 0 }}>Nobody holds anything here yet.</p>
            )}
            {!here && (
              <button className="btn-sm" onClick={() => act(() => api.player.moveDistrict(data.district.id), `Moved to ${data.district.name}.`)}>
                Move here — you have to be standing in a district to take a racket
              </button>
            )}
          </Card>

          <div className="grid grid-2">
            {data.rackets.map((r) => {
              const owned = !!r.ownerFamilyId;
              const yours = r.yours;
              const grace = r.graceLeft > 0;
              return (
                <Card key={r.id}>
                  <div className="card-header">
                    <h3>{r.name}</h3>
                    <span className="mono money-dirty">{money(r.income)}/wk</span>
                  </div>
                  <div className="row tiny muted" style={{ marginBottom: 10 }}>
                    <Badge>{r.label}</Badge>
                    {owned ? (
                      <span style={{ color: r.ownerFamily?.colour }}>
                        {r.ownerFamily?.logo} {r.ownerFamily?.name}
                        {r.ownerCrew ? ` · ${r.ownerCrew.name}` : ''}
                      </span>
                    ) : (
                      <span className="money-clean">Unclaimed — {money(r.price)}</span>
                    )}
                    {owned && <span>{r.defenders} defender(s)</span>}
                  </div>

                  {yours && <Badge kind="politician">Yours</Badge>}

                  {!owned && (
                    <button
                      className="btn-block"
                      disabled={!me.familyId || me.clean < r.price}
                      onClick={() => act(() => api.rackets.buy(r.id), `Bought ${r.name}.`).then(load)}
                    >
                      {!me.familyId ? 'You need a family' : me.clean < r.price ? 'Cannot afford it' : `Buy for ${money(r.price)}`}
                    </button>
                  )}

                  {owned && !yours && (
                    <>
                      <div className="row-between tiny" style={{ marginBottom: 4 }}>
                        <span>Takeover odds</span>
                        <strong className="mono">{r.takeoverChance != null ? pct(r.takeoverChance) : '—'}</strong>
                      </div>
                      <div className="meter" style={{ marginBottom: 10 }}>
                        <span style={{ width: `${(r.takeoverChance || 0) * 100}%`, background: 'var(--blood)' }} />
                      </div>
                      <button
                        className="btn-primary btn-block"
                        disabled={!here || !me.familyId || grace || me.jailSecondsLeft > 0}
                        onClick={async () => {
                          const res = await act(() => api.rackets.takeover(r.id));
                          if (res) { setResult(res); load(); }
                        }}
                      >
                        {grace ? `Just changed hands — ${r.graceLeft}s`
                          : !here ? 'You are not in this district'
                            : !me.familyId ? 'You need a family' : 'Move on it'}
                      </button>
                    </>
                  )}
                </Card>
              );
            })}
          </div>

          <Card title="How a takeover works">
            <p className="faint tiny" style={{ marginTop: 0, marginBottom: 0 }}>
              You have to be standing in the district, you have to be made, and your family
              has to operate in the city. Bringing a crew is by far the biggest factor —
              moving on a racket alone carries a heavy penalty and will usually fail against
              anything well defended. A racket that has just changed hands cannot be moved on
              again for {Math.round(CONFIG.RACKET_GRACE_SEC / 60)} minutes.
            </p>
          </Card>
        </>
      )}

      {mine.length > 0 && (
        <Card title="Everything your family holds">
          {mine.map((r) => (
            <div className="list-row" key={r.racketId}>
              <div style={{ flex: 1 }}>
                <div>{r.name}</div>
                <div className="faint tiny">
                  {districtById(r.districtId)?.name}, {cityById(districtById(r.districtId)?.cityId)?.short}
                </div>
              </div>
              <span className="mono money-dirty">{money(r.income)}/wk</span>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
