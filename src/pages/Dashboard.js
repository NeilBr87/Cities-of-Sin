import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useGame } from '../state/GameContext';
import { Card, Stat, Badge, Empty, Loading } from '../components/ui';
import { cityById, districtById } from '../game/world';
import { rank, PATHS } from '../game/ranks';
import { money, duration, timeAgo, fullName } from '../game/format';
import { ERA } from '../game/era';
import { USING_MOCK } from '../api/client';

export default function Dashboard() {
  const { me, act } = useGame();
  const [district, setDistrict] = useState(null);
  const [history, setHistory] = useState(null);

  useEffect(() => {
    if (!me) return;
    api.territory.district(me.districtId).then(setDistrict).catch(() => setDistrict(null));
    api.crimes.history().then(setHistory).catch(() => setHistory([]));
  }, [me]);

  if (!me) return <Loading />;

  const r = rank(me.rankId);
  const city = cityById(me.cityId);
  const d = districtById(me.districtId);
  const jailed = me.jailSecondsLeft > 0;

  return (
    <>
      <h1>{fullName(me)}</h1>
      <p className="flavour" style={{ marginTop: -8 }}>
        {r.blurb}
      </p>

      {jailed && (
        <Card className="card">
          <h3 style={{ color: 'var(--blood)' }}>You are in a cell in {cityById(me.jailCityId)?.name}</h3>
          <p className="muted">
            {duration(me.jailSecondsLeft)} left. There are things to do inside —{' '}
            <Link to="/prison">head to the block</Link>.
          </p>
        </Card>
      )}

      <div className="grid grid-2">
        <Card title="Standing">
          <div className="grid grid-4">
            <Stat label="Respect" value={me.respect?.toLocaleString?.() ?? me.respect} />
            <Stat label="Clean" value={money(me.clean)} tone="money" />
            <Stat label="Dirty" value={money(me.dirty)} tone="dirty" />
            <Stat label="Heat" value={me.heat} tone="heat" />
            <Stat label="Nerve" value={`${me.nerve}/${me.nerveMax}`} />
            <Stat label="Health" value={me.health} />
          </div>
          <hr />
          <div className="row">
            <Badge kind={me.path}>{r.label}</Badge>
            {me.family && <Badge>{me.family.logo} {me.family.name}</Badge>}
            {me.crew && <Badge>{me.crew.name}</Badge>}
            {me.party && <Badge kind="politician">{me.party.name}</Badge>}
            {me.department && <Badge kind="police">{me.department.name}</Badge>}
          </div>
          {me.contracts?.length > 0 && (
            <p className="tiny muted" style={{ marginBottom: 0 }}>
              Your family holds contracts: {me.contracts.join(', ')} — that unlocks project work.
            </p>
          )}
        </Card>

        <Card title="Skills">
          {Object.entries(me.skills || {}).map(([k, v]) => (
            <div key={k} style={{ marginBottom: 9 }}>
              <div className="row-between tiny">
                <span style={{ textTransform: 'capitalize' }}>{k}</span>
                <span className="mono">{Math.floor(v)}</span>
              </div>
              <div className="meter"><span style={{ width: `${v}%` }} /></div>
            </div>
          ))}
        </Card>

        <Card
          title={`${d?.name}, ${city?.name}`}
          action={<Link to="/district" className="btn btn-sm">Open district</Link>}
        >
          <p className="flavour" style={{ marginTop: 0 }}>{city?.signatureBlurb}</p>
          <div className="grid grid-3">
            <Stat label="Wealth" value={`×${d?.wealth}`} sub="payout multiplier" />
            <Stat label="Policing" value={`×${d?.policing}`} sub="heat and arrest odds" />
            <Stat label="Open cases" value={district?.openCases ?? '—'} />
          </div>
          {district?.councilman && (
            <p className="tiny muted" style={{ marginBottom: 0 }}>
              Councilman: <strong>{fullName(district.councilman)}</strong> — they award the small contracts here.
            </p>
          )}
        </Card>

        <Card title="Recent activity">
          {history === null ? <Loading /> : history.length === 0 ? (
            <Empty>Nothing yet. {me.path === PATHS.MAFIA ? <Link to="/crimes">Go earn something.</Link> : 'Get to work.'}</Empty>
          ) : (
            history.slice(0, 8).map((h) => (
              <div className="list-row" key={h.id}>
                <div style={{ flex: 1 }}>
                  <div>{h.text}</div>
                  <div className="faint tiny">{timeAgo(h.at)}</div>
                </div>
              </div>
            ))
          )}
        </Card>
      </div>

      {USING_MOCK && (
        <Card title="Developer tools">
          <p className="faint tiny" style={{ marginTop: 0 }}>
            The weekly economy — salaries, kick-ups, racket income, upkeep and interest — runs on a
            cron in production. Fire it manually here to see the money move.
          </p>
          <div className="row">
            <button
              className="btn-sm"
              onClick={() => act(
                () => api.dev.runWeekly(),
                (res) => `Week run: ${money(res.summary.salaries)} in salaries, ${money(res.summary.kickUps)} kicked up, ${money(res.summary.upkeep)} in upkeep.`
              )}
            >
              Run the weekly tick
            </button>
            <button
              className="btn-sm"
              onClick={async () => { await api.dev.resetWorld(); window.location.reload(); }}
            >
              Reset the world
            </button>
            <span className="faint tiny">Era: {ERA.label} ({ERA.year})</span>
          </div>
        </Card>
      )}
    </>
  );
}
