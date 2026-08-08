import React, { useCallback, useEffect, useState } from 'react';
import api from '../api';
import { useGame } from '../state/GameContext';
import { Card, Empty, Loading, Countdown, Tabs, Badge } from '../components/ui';
import { CRIME_TIERS } from '../game/crimes';
import { money, pct, duration } from '../game/format';

export default function Crimes() {
  const { me, act } = useGame();
  const [crimes, setCrimes] = useState(null);
  const [tier, setTier] = useState('1');
  const [result, setResult] = useState(null);

  const load = useCallback(() => {
    api.crimes.list().then(setCrimes).catch(() => setCrimes([]));
  }, []);

  useEffect(load, [load, me?.districtId, me?.rankId]);

  async function commit(c) {
    const res = await act(() => api.crimes.commit(c.id));
    if (res) {
      setResult(res);
      load();
    }
  }

  if (!crimes) return <Loading what="Casing the neighbourhood" />;

  const shown = crimes.filter((c) => String(c.tier) === tier);
  const jailed = me?.jailSecondsLeft > 0;

  return (
    <>
      <h1>Crimes</h1>
      <p className="flavour" style={{ marginTop: -8 }}>
        Everything you earn here is dirty. Wash it at the bank before it is worth anything to a bank.
      </p>

      {jailed && <div className="alert error">You cannot work from a cell.</div>}

      {result && (
        <div className={`alert ${result.success ? 'good' : 'error'}`}>
          <strong>{result.message}</strong>
          {result.success && (
            <span className="faint"> {' '}+{result.respect} respect, +{result.heat} heat.</span>
          )}
          {result.jailedSeconds > 0 && (
            <span className="faint"> {' '}Sentence: {duration(result.jailedSeconds)}.</span>
          )}
        </div>
      )}

      <Tabs
        active={tier}
        onChange={setTier}
        tabs={Object.values(CRIME_TIERS).map((t) => ({ id: String(t.id), label: `${t.id}. ${t.label}` }))}
      />
      <p className="faint tiny" style={{ marginTop: -8 }}>{CRIME_TIERS[tier].blurb}</p>

      <div className="grid grid-2">
        {shown.length === 0 && <Empty>Nothing available at this tier.</Empty>}
        {shown.map((c) => {
          const blocked = c.locked || !c.affordableNerve || c.cooldownLeft > 0 || jailed;
          return (
            <Card key={c.id}>
              <div className="card-header">
                <h3>{c.name}</h3>
                <span className="mono money-dirty">{money(c.estimatedPayout)}</span>
              </div>
              <p className="flavour" style={{ marginTop: 0 }}>{c.flavour}</p>

              <div className="row tiny muted" style={{ marginBottom: 10 }}>
                <span>Odds <strong className="mono">{pct(c.successChance)}</strong></span>
                <span>Nerve <strong className="mono">{c.nerve}</strong></span>
                <span>Heat <strong className="mono">+{c.heat}</strong></span>
                <span>Cell <strong className="mono">{duration(c.sentenceSec)}</strong></span>
              </div>

              {c.locked && (
                <div className="row" style={{ marginBottom: 10 }}>
                  {c.lockReasons.map((rsn) => <Badge key={rsn}>{rsn}</Badge>)}
                </div>
              )}

              <button
                className="btn-primary btn-block"
                disabled={blocked}
                onClick={() => commit(c)}
              >
                {c.cooldownLeft > 0
                  ? <>Cooling off — <Countdown seconds={c.cooldownLeft} onDone={load} /></>
                  : !c.affordableNerve ? 'Not enough nerve'
                    : c.locked ? 'Locked' : 'Do it'}
              </button>
            </Card>
          );
        })}
      </div>
    </>
  );
}
