import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../lib/api';
import { useCharacter, useSession } from '../state/SessionProvider';
import { Alert, Card, Empty, Loading, Tabs } from '../components/ui';
import { duration, money, pct } from '../lib/format';
import type { Crime, CrimeResult } from '../lib/types';

const TIER_LABEL: Record<number, { label: string; blurb: string }> = {
  1: { label: 'Street', blurb: 'Nickels and dimes. Nobody writes it down.' },
  2: { label: 'Organised', blurb: 'Planned, and worth a warrant.' },
  3: { label: 'Projects', blurb: 'Needs a politician in your pocket before it exists.' },
};

export default function Crimes() {
  const { character } = useCharacter();
  const { act } = useSession();

  const [crimes, setCrimes] = useState<Crime[] | null>(null);
  const [tier, setTier] = useState<'1' | '2'>('1');
  const [last, setLast] = useState<CrimeResult | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  // Local clock so cooldowns count down without re-fetching every second.
  const [, tick] = useState(0);
  const loadedAt = useRef(Date.now());

  const load = useCallback(async () => {
    try {
      const list = await api.crimes.list();
      setCrimes(list);
      loadedAt.current = Date.now();
    } catch {
      setCrimes([]);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  async function commit(crime: Crime) {
    setPending(crime.id);
    const result = await act(() => api.crimes.commit(crime.id));
    setPending(null);
    if (result) {
      setLast(result);
      void load();
    }
  }

  if (!crimes) return <Loading label="Casing the joint" />;

  const elapsed = (Date.now() - loadedAt.current) / 1000;
  const visible = crimes.filter((c) => String(c.tier) === tier);

  return (
    <>
      <h1>Work</h1>
      <p className="flavour" style={{ marginTop: -6 }}>
        Everything here pays dirty. Nothing here is legal. The odds move with the
        district you are standing in and the heat on your back.
      </p>

      {character.jailed && (
        <Alert kind="error">
          You are in a cell for another {duration(character.jail_seconds_left)}. Nothing to steal in here.
        </Alert>
      )}

      {last && (
        <Card className={last.success ? '' : 'card'} title={last.success ? 'It worked' : 'It went wrong'}>
          <p className="flavour" style={{ marginTop: 0 }}>{last.flavour}</p>
          <div className="grid grid-4">
            <div className="stat">
              <div className="stat-label">Take</div>
              <div className="stat-value dirty">{last.payout > 0 ? money(last.payout) : '—'}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Respect</div>
              <div className="stat-value">{last.respect_gained > 0 ? `+${last.respect_gained}` : '—'}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Heat</div>
              <div className="stat-value heat">+{last.heat_gained}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Odds were</div>
              <div className="stat-value">{pct(last.chance)}</div>
            </div>
          </div>
          {last.arrested && (
            <Alert kind="error">
              Picked up on the spot. {duration(last.sentence_seconds)} inside unless somebody posts bail.
            </Alert>
          )}
        </Card>
      )}

      <Tabs
        tabs={[
          { id: '1', label: TIER_LABEL[1]!.label },
          { id: '2', label: TIER_LABEL[2]!.label },
        ]}
        active={tier}
        onChange={setTier}
      />

      <p className="faint tiny" style={{ marginTop: -8 }}>{TIER_LABEL[Number(tier)]?.blurb}</p>

      <Card flush>
        {visible.length === 0 && <Empty>Nothing at this level yet.</Empty>}
        {visible.map((c) => {
          const cooling = Math.max(0, c.cooldown_left - elapsed);
          const cantAfford = character.nerve < c.nerve_cost;
          const blocked = c.locked || cooling > 0 || cantAfford || character.jailed;

          return (
            <div className={`crime ${c.locked ? 'locked' : ''}`} key={c.id}>
              <div>
                <div className="crime-name">{c.name}</div>
                <div className="flavour" style={{ fontSize: 13 }}>{c.flavour}</div>
                <div className="crime-meta">
                  <span className="faint">Pays <b style={{ color: 'var(--dirty)' }}>~{money(c.expected_payout)}</b></span>
                  <span className="faint">Odds <b>{pct(c.chance)}</b></span>
                  <span className="faint">Nerve <b>{c.nerve_cost}</b></span>
                  <span className="faint">Heat <b>+{c.heat}</b></span>
                  <span className="faint">If caught <b>{duration(c.sentence_seconds)}</b></span>
                </div>
              </div>

              <div className="crime-act">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={blocked || pending === c.id}
                  onClick={() => void commit(c)}
                >
                  {pending === c.id ? 'Going…' : 'Do it'}
                </button>
                {c.locked && <span className="tiny faint">Needs {c.min_respect} respect</span>}
                {!c.locked && cooling > 0 && (
                  <span className="tiny faint mono">{duration(cooling)}</span>
                )}
                {!c.locked && cooling <= 0 && cantAfford && (
                  <span className="tiny faint">Not enough nerve</span>
                )}
              </div>
            </div>
          );
        })}
      </Card>
    </>
  );
}
