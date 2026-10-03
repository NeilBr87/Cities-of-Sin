import { useEffect, useState } from 'react';
import api from '../lib/api';
import { useCharacter } from '../state/SessionProvider';
import { Badge, Card, Empty, Loading, Tabs } from '../components/ui';
import { money } from '../lib/format';
import { rankOf } from '../lib/ranks';
import type { LeaderboardRow } from '../lib/types';

type Metric = 'respect' | 'clean' | 'heat';

const TABS: { id: Metric; label: string }[] = [
  { id: 'respect', label: 'Respect' },
  { id: 'clean', label: 'Money' },
  { id: 'heat', label: 'Most wanted' },
];

export default function Leaderboard() {
  const { character } = useCharacter();
  const [metric, setMetric] = useState<Metric>('respect');
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);

  useEffect(() => {
    setRows(null);
    api.leaderboard.top(metric).then(setRows).catch(() => setRows([]));
  }, [metric]);

  return (
    <>
      <h1>Standing</h1>
      <p className="flavour" style={{ marginTop: -6 }}>
        Everybody on this list is a person, and every one of them can read it too.
      </p>

      <Tabs tabs={TABS} active={metric} onChange={setMetric} />

      <Card flush>
        {rows === null && <Loading label="Counting" />}
        {rows?.length === 0 && <Empty>Nobody has done anything yet.</Empty>}
        {rows && rows.length > 0 && (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>#</th>
                  <th>Name</th>
                  <th>Rank</th>
                  <th>City</th>
                  <th className="num">Respect</th>
                  <th className="num">{metric === 'heat' ? 'Heat' : 'Clean'}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} style={r.id === character.id ? { background: 'var(--brass-glow)' } : undefined}>
                    <td className="mono faint">{i + 1}</td>
                    <td>
                      {r.name}
                      {r.id === character.id && <span className="faint tiny"> (you)</span>}
                    </td>
                    <td><Badge kind={r.path}>{rankOf(r.rank_id).label}</Badge></td>
                    <td className="dim">{r.city}</td>
                    <td className="num">{r.respect.toLocaleString()}</td>
                    <td className="num" style={{ color: metric === 'heat' ? 'var(--heat)' : 'var(--clean)' }}>
                      {metric === 'heat' ? Math.round(r.heat) : money(r.clean)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="tiny faint">
        Money shown is clean money only. What somebody has washed, buried in the
        vault or is carrying dirty is their business.
      </p>
    </>
  );
}
