import React, { useCallback, useEffect, useState } from 'react';
import api from '../api';
import { useGame } from '../state/GameContext';
import { Card, Empty, Loading, Badge, Tabs } from '../components/ui';
import { money } from '../game/format';
import { eraAllows, ERA } from '../game/era';

export default function Market() {
  const { me, act } = useGame();
  const [tab, setTab] = useState('guns');
  const [cat, setCat] = useState(null);
  const [inv, setInv] = useState([]);

  const load = useCallback(() => {
    api.market.catalogue().then(setCat).catch(() => setCat(null));
    api.market.inventory().then(setInv).catch(() => setInv([]));
  }, []);
  useEffect(load, [load]);

  if (!me || !cat) return <Loading what="Opening the back room" />;

  const lists = { guns: cat.guns, armour: cat.armour, vehicles: cat.vehicles };
  const items = (lists[tab] || []).filter((i) => eraAllows(i.id));
  const owned = (id) => inv.find((i) => i.itemId === id);

  return (
    <>
      <h1>Market</h1>
      <p className="flavour" style={{ marginTop: -8 }}>
        Everything here is bought with clean money. What it is used for afterwards is your business.
        Some stock does not exist in {ERA.label} — the catalogue changes with the era.
      </p>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'guns', label: 'Guns' },
          { id: 'armour', label: 'Armour' },
          { id: 'vehicles', label: 'Vehicles' },
          { id: 'inventory', label: `Owned (${inv.length})` },
        ]}
      />

      {tab !== 'inventory' && (
        <div className="grid grid-3">
          {items.map((i) => {
            const have = owned(i.id);
            return (
              <Card key={i.id}>
                <div className="card-header">
                  <h3>{i.name}</h3>
                  <span className="mono money-clean">{money(i.price)}</span>
                </div>
                <p className="flavour" style={{ marginTop: 0 }}>{i.blurb}</p>
                <div className="row tiny muted" style={{ marginBottom: 10 }}>
                  {i.attack !== undefined && <span>ATK <strong className="mono">{i.attack}</strong></span>}
                  {i.defence !== undefined && <span>DEF <strong className="mono">{i.defence}</strong></span>}
                  {i.concealment !== undefined && <span>Hide <strong className="mono">{i.concealment}</strong></span>}
                  {i.speed !== undefined && <span>Speed <strong className="mono">{i.speed}</strong></span>}
                  {i.capacity !== undefined && <span>Seats <strong className="mono">{i.capacity}</strong></span>}
                  {have && <Badge>Owned ×{have.qty}</Badge>}
                </div>
                <button
                  className="btn-block"
                  disabled={me.clean < i.price}
                  onClick={() => act(() => api.market.buyItem(i.id), `Bought the ${i.name}.`).then(load)}
                >
                  {me.clean < i.price ? 'Cannot afford it' : 'Buy'}
                </button>
              </Card>
            );
          })}
        </div>
      )}

      {tab === 'inventory' && (
        <Card title="What you are carrying">
          {inv.length === 0 ? <Empty>You own nothing. That will get you killed.</Empty> : inv.map((row) => (
            <div className="list-row" key={row.id}>
              <div style={{ flex: 1 }}>
                <div>{row.item?.name} <span className="faint tiny">×{row.qty}</span></div>
                <div className="faint tiny">{row.slot}{row.equipped ? ' · equipped' : ''}</div>
              </div>
              {!row.equipped && row.slot !== 'vehicle' && (
                <button className="btn-sm" onClick={() => act(() => api.market.equip(row.itemId, row.slot), 'Equipped.').then(load)}>
                  Equip
                </button>
              )}
              <button className="btn-sm" onClick={() => act(() => api.market.sellItem(row.itemId), (r) => `Sold for ${money(r.refund)}.`).then(load)}>
                Sell
              </button>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
