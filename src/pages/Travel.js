import React from 'react';
import api from '../api';
import { useGame } from '../state/GameContext';
import { Card, Loading, Stat } from '../components/ui';
import { CITIES, travelCost, travelMinutes } from '../game/world';
import { money } from '../game/format';

export default function Travel() {
  const { me, act } = useGame();
  if (!me) return <Loading />;

  return (
    <>
      <h1>Travel</h1>
      <p className="flavour" style={{ marginTop: -8 }}>
        A car moves you around a city. Only a plane moves you between them — and the ticket is on you.
      </p>

      <div className="grid grid-3">
        {CITIES.map((c) => {
          const cost = travelCost(me.cityId, c.id);
          const here = c.id === me.cityId;
          return (
            <Card key={c.id}>
              <div className="card-header">
                <h3>{c.name}</h3>
                {here && <span className="badge">You are here</span>}
              </div>
              <p className="flavour" style={{ marginTop: 0 }}>{c.tagline}</p>
              <p className="tiny muted">{c.signatureBlurb}</p>
              <div className="grid grid-2" style={{ marginBottom: 12 }}>
                <Stat label="Ticket" value={here ? '—' : money(cost)} />
                <Stat label="Flight" value={here ? '—' : `${travelMinutes(me.cityId, c.id)}m`} />
              </div>
              <button
                className="btn-brass btn-block"
                disabled={here || me.clean < cost || me.jailSecondsLeft > 0}
                onClick={() => act(() => api.player.travel(c.id), `Landed in ${c.name}.`)}
              >
                {here ? 'Current city' : me.clean < cost ? 'Cannot afford the ticket' : `Fly to ${c.name}`}
              </button>
            </Card>
          );
        })}
      </div>
    </>
  );
}
