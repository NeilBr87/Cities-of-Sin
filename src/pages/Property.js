import React, { useCallback, useEffect, useState } from 'react';
import api from '../api';
import { useGame } from '../state/GameContext';
import { Card, Empty, Loading, Badge, Tabs, ConfirmButton } from '../components/ui';
import { money, pct } from '../game/format';
import { districtsOf, districtById } from '../game/world';

export default function Property() {
  const { me, act } = useGame();
  const [tab, setTab] = useState('mine');
  const [districtId, setDistrictId] = useState(me?.districtId);
  const [listings, setListings] = useState(null);
  const [mine, setMine] = useState(null);

  const load = useCallback(() => {
    api.property.mine().then(setMine).catch(() => setMine({ properties: [], fronts: [] }));
    if (districtId) api.property.listings(districtId).then(setListings).catch(() => setListings(null));
  }, [districtId]);
  useEffect(load, [load]);

  if (!me || !mine) return <Loading what="Reading the deeds" />;

  return (
    <>
      <h1>Property</h1>
      <p className="flavour" style={{ marginTop: -8 }}>
        A home is a defence: if you are inside one when someone comes for you, its safety rating is what
        stands between you and them. A front is a machine that turns dirty money into clean.
      </p>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'mine', label: `Yours (${mine.properties.length + mine.fronts.length})` },
          { id: 'buy', label: 'Buy' },
        ]}
      />

      {tab === 'mine' && (
        <>
          <Card title="Homes">
            {mine.properties.length === 0 ? <Empty>You sleep somewhere nobody guarantees.</Empty> : mine.properties.map((p) => (
              <div className="list-row" key={p.id}>
                <div style={{ flex: 1 }}>
                  <div>{p.type?.name} — {p.district?.name}</div>
                  <div className="faint tiny">Safety {p.safety} · upkeep {money(p.upkeep)}/week</div>
                </div>
                {String(me.insidePropertyId) === String(p.id) ? (
                  <>
                    <Badge kind="police">Inside</Badge>
                    <button className="btn-sm" onClick={() => act(() => api.player.leaveProperty(), 'Back on the street.')}>
                      Step out
                    </button>
                  </>
                ) : (
                  p.districtId === me.districtId && (
                    <button className="btn-sm" onClick={() => act(() => api.player.enterProperty(p.id), 'Doors locked.')}>
                      Go inside
                    </button>
                  )
                )}
                <ConfirmButton className="btn-sm" onConfirm={() => act(() => api.property.sell(p.id), (r) => `Sold for ${money(r.refund)}.`).then(load)}>
                  Sell
                </ConfirmButton>
              </div>
            ))}
          </Card>

          <Card title="Fronts">
            {mine.fronts.length === 0 ? <Empty>No businesses. Your money stays dirty and small.</Empty> : mine.fronts.map((f) => (
              <div className="list-row" key={f.id}>
                <div style={{ flex: 1 }}>
                  <div>{f.front?.name} — {f.district?.name}</div>
                  <div className="faint tiny">
                    Washes {money(f.front?.weeklyCapacity)}/week at {pct(f.front?.rate)} ·
                    {' '}{money((f.front?.weeklyCapacity || 0) - (f.usedThisWeek || 0))} left this week
                  </div>
                </div>
              </div>
            ))}
          </Card>
        </>
      )}

      {tab === 'buy' && (
        <>
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

          {!listings ? <Loading /> : (
            <>
              <p className="faint tiny">
                Prices scale with how rich {districtById(districtId)?.name} is (×{districtById(districtId)?.wealth}).
              </p>
              <div className="grid grid-3">
                {listings.types.map((t) => (
                  <Card key={t.id}>
                    <div className="card-header">
                      <h3>{t.name}</h3>
                      <span className="mono money-clean">{money(t.price)}</span>
                    </div>
                    <p className="flavour" style={{ marginTop: 0 }}>{t.blurb}</p>
                    <div className="row tiny muted" style={{ marginBottom: 10 }}>
                      <span>Safety <strong className="mono">{t.safety}</strong></span>
                      <span>Upkeep <strong className="mono">{money(t.upkeep)}</strong>/wk</span>
                    </div>
                    <button
                      className="btn-block"
                      disabled={me.clean < t.price}
                      onClick={() => act(() => api.property.buy(t.id, districtId), `Bought a ${t.name}.`).then(load)}
                    >
                      {me.clean < t.price ? 'Cannot afford it' : 'Buy'}
                    </button>
                  </Card>
                ))}
              </div>

              <h2 style={{ marginTop: 24 }}>Businesses</h2>
              <div className="grid grid-3">
                {listings.fronts.map((f) => (
                  <Card key={f.id}>
                    <div className="card-header">
                      <h3>{f.name}</h3>
                      <span className="mono money-clean">{money(f.price)}</span>
                    </div>
                    <p className="flavour" style={{ marginTop: 0 }}>{f.blurb}</p>
                    <div className="row tiny muted" style={{ marginBottom: 10 }}>
                      <span>Rate <strong className="mono">{pct(f.rate)}</strong></span>
                      <span>Cap <strong className="mono">{money(f.weeklyCapacity)}</strong>/wk</span>
                    </div>
                    <button
                      className="btn-block"
                      disabled={me.clean < f.price}
                      onClick={() => act(() => api.property.buyFront(f.id, districtId), `Bought the ${f.name}.`).then(load)}
                    >
                      {me.clean < f.price ? 'Cannot afford it' : 'Buy'}
                    </button>
                  </Card>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
