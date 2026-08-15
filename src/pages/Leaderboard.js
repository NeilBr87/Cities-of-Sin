import React, { useEffect, useState } from 'react';
import api from '../api';
import { Card, Loading, Badge, Tabs, Empty } from '../components/ui';
import Avatar from '../components/Avatar';
import { fullName } from '../game/format';
import { rank } from '../game/ranks';
import { cityById } from '../game/world';

export default function Leaderboard() {
  const [metric, setMetric] = useState('respect');
  const [rows, setRows] = useState(null);

  useEffect(() => {
    setRows(null);
    api.player.leaderboard(metric).then(setRows).catch(() => setRows([]));
  }, [metric]);

  return (
    <>
      <h1>Standing</h1>
      <p className="flavour" style={{ marginTop: -8 }}>
        Respect is what gets you made and promoted. Heat is what gets you arrested. Both are public.
      </p>

      <Tabs
        active={metric}
        onChange={setMetric}
        tabs={[
          { id: 'respect', label: 'Most respected' },
          { id: 'heat', label: 'Hottest' },
        ]}
      />

      <Card>
        {rows === null ? <Loading /> : rows.length === 0 ? <Empty>Nobody yet.</Empty> : rows.map((p, i) => (
          <div className="list-row" key={p.id}>
            <span className="mono faint" style={{ width: 26 }}>{i + 1}</span>
            <Avatar player={p} size={32} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div>{fullName(p)} <span className="faint tiny">@{p.username}</span></div>
              <div className="row" style={{ gap: 6, marginTop: 3 }}>
                <Badge kind={p.path}>{rank(p.rankId).label}</Badge>
                <span className="faint tiny">{cityById(p.cityId)?.short}</span>
              </div>
            </div>
            <span className={`mono ${metric === 'heat' ? 'danger' : ''}`}>
              {(p[metric] ?? 0).toLocaleString()}
            </span>
          </div>
        ))}
      </Card>
    </>
  );
}
