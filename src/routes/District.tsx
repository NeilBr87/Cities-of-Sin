import { useCallback, useEffect, useState } from 'react';
import api from '../lib/api';
import { useCharacter, useSession } from '../state/SessionProvider';
import { Badge, Card, Empty, Loading } from '../components/ui';
import { nameOf } from '../lib/format';
import { rankOf } from '../lib/ranks';
import type { District as Dist } from '../lib/types';

interface Occupant {
  id: string;
  first_name: string;
  nickname: string | null;
  last_name: string;
  path: string;
  rank_id: string;
  respect: number;
  heat: number;
}

export default function District() {
  const { character, city, district } = useCharacter();
  const { act } = useSession();

  const [districts, setDistricts] = useState<Dist[] | null>(null);
  const [here, setHere] = useState<Occupant[] | null>(null);
  const [moving, setMoving] = useState<string | null>(null);

  const loadOccupants = useCallback(async () => {
    try {
      setHere(await api.world.whoIsHere(district.id) as Occupant[]);
    } catch {
      setHere([]);
    }
  }, [district.id]);

  useEffect(() => {
    api.world.districts(city.id).then(setDistricts).catch(() => setDistricts([]));
  }, [city.id]);

  useEffect(() => { void loadOccupants(); }, [loadOccupants]);

  async function move(id: string) {
    setMoving(id);
    await act(() => api.player.moveToDistrict(id), 'Moved.');
    setMoving(null);
  }

  if (!districts) return <Loading label="Reading the map" />;

  return (
    <>
      <h1>{city.name}</h1>
      <p className="flavour" style={{ marginTop: -6 }}>{city.tagline}</p>

      <div className="grid grid-2">
        <Card title="The map" flush>
          {districts.map((d) => {
            const isHere = d.id === district.id;
            return (
              <div className="crime" key={d.id}>
                <div>
                  <div className="crime-name">
                    {d.name} {isHere && <Badge kind="good">You are here</Badge>}
                  </div>
                  <div className="flavour" style={{ fontSize: 13 }}>{d.flavour}</div>
                  <div className="crime-meta">
                    <span className="faint">Wealth <b>{d.wealth.toFixed(2)}×</b></span>
                    <span className="faint">Policing <b>{d.policing.toFixed(2)}×</b></span>
                  </div>
                </div>
                <div className="crime-act">
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={isHere || character.jailed || moving === d.id}
                    onClick={() => void move(d.id)}
                  >
                    {moving === d.id ? 'Moving…' : 'Go'}
                  </button>
                </div>
              </div>
            );
          })}
        </Card>

        <Card
          title={`On the street in ${district.name}`}
          action={
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => void loadOccupants()}>
              Refresh
            </button>
          }
          flush
        >
          {here === null && <Loading label="Looking around" />}
          {here?.length === 0 && <Empty>Nobody but you and the pigeons.</Empty>}
          {here && here.length > 0 && (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Rank</th>
                    <th className="num">Respect</th>
                    <th className="num">Heat</th>
                  </tr>
                </thead>
                <tbody>
                  {here.map((o) => (
                    <tr key={o.id}>
                      <td>
                        {nameOf(o)}
                        {o.id === character.id && <span className="faint tiny"> (you)</span>}
                      </td>
                      <td><Badge kind={o.path}>{rankOf(o.rank_id).label}</Badge></td>
                      <td className="num">{o.respect.toLocaleString()}</td>
                      <td className="num" style={{ color: o.heat >= 45 ? 'var(--heat)' : undefined }}>
                        {Math.round(o.heat)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="tiny faint" style={{ padding: '10px 16px', margin: 0 }}>
            Attacks, muggings and territory arrive with rackets. For now this is
            who you are sharing the odds with — a busy district is a policed one.
          </p>
        </Card>
      </div>
    </>
  );
}
