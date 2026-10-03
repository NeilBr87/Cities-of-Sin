import { useEffect, useState } from 'react';
import api from '../lib/api';
import { useCharacter, useSession } from '../state/SessionProvider';
import { Alert, Card, Loading } from '../components/ui';
import { money } from '../lib/format';
import type { City } from '../lib/types';

// Kept in sync with the flight_cost row in game_config. Displayed only — the
// server charges the real number.
const FLIGHT_COST = 1500;

export default function Travel() {
  const { character, city } = useCharacter();
  const { act } = useSession();
  const [cities, setCities] = useState<City[] | null>(null);
  const [flying, setFlying] = useState<string | null>(null);

  useEffect(() => {
    api.world.cities().then(setCities).catch(() => setCities([]));
  }, []);

  async function fly(id: string) {
    setFlying(id);
    await act(() => api.player.flyToCity(id), 'Wheels down.');
    setFlying(null);
  }

  if (!cities) return <Loading label="Checking departures" />;

  return (
    <>
      <h1>Travel</h1>
      <p className="flavour" style={{ marginTop: -6 }}>
        Districts are a walk. Cities are a flight, and the airline only takes
        clean money.
      </p>

      {character.jailed && <Alert kind="error">You are not going anywhere. You are in a cell.</Alert>}

      <div className="grid grid-2">
        {cities.map((c) => {
          const isHere = c.id === city.id;
          const canAfford = character.clean >= FLIGHT_COST;
          return (
            <Card
              key={c.id}
              title={c.name}
              action={
                isHere
                  ? <span className="badge good">You are here</span>
                  : (
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      disabled={character.jailed || !canAfford || flying === c.id}
                      onClick={() => void fly(c.id)}
                    >
                      {flying === c.id ? 'Boarding…' : `Fly — ${money(FLIGHT_COST)}`}
                    </button>
                  )
              }
            >
              <p className="flavour" style={{ marginTop: 0 }}>{c.tagline}</p>
              <div className="label" style={{ marginBottom: 4 }}>{c.signature_label}</div>
              <p className="tiny dim" style={{ margin: 0 }}>{c.signature_blurb}</p>
              {!isHere && !canAfford && (
                <p className="tiny" style={{ color: 'var(--blood)', marginTop: 8, marginBottom: 0 }}>
                  You need {money(FLIGHT_COST)} clean. Wash something.
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
