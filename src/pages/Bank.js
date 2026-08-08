import React, { useCallback, useEffect, useState } from 'react';
import api from '../api';
import { useGame } from '../state/GameContext';
import { Card, Field, Empty, Loading, Stat } from '../components/ui';
import { money, fullName, pct } from '../game/format';
import { CONFIG } from '../game/economy';

export default function Bank() {
  const { me, act } = useGame();
  const [data, setData] = useState(null);
  const [amount, setAmount] = useState('');
  const [frontId, setFrontId] = useState('');
  const [send, setSend] = useState({ q: '', to: null, amount: '', kind: 'clean' });
  const [found, setFound] = useState([]);

  const load = useCallback(() => {
    api.bank.summary().then(setData).catch(() => setData(null));
  }, []);
  useEffect(load, [load, me?.dirty, me?.clean]);

  if (!me || !data) return <Loading what="Counting" />;

  const chosen = data.fronts.find((f) => String(f.id) === String(frontId));
  const rate = chosen?.def?.rate ?? CONFIG.LAUNDER_FLOOR_RATE;
  const amt = Number(amount || 0);

  return (
    <>
      <h1>Bank &amp; Laundering</h1>
      <p className="flavour" style={{ marginTop: -8 }}>
        Dirty money buys guns, bribes and favours. It does not buy property, tickets or a family.
        For that it has to be washed — and washing costs.
      </p>

      <div className="grid grid-3">
        <Stat label="Clean" value={money(me.clean)} tone="money" sub={`${pct(CONFIG.BANK_INTEREST_WEEKLY)} weekly interest`} />
        <Stat label="Dirty" value={money(me.dirty)} tone="dirty" sub="lost entirely if you are killed" />
        <Stat label="Wash capacity left" value={money(data.launderCapacity)} sub="resets weekly" />
      </div>

      <Card title="Wash money">
        {data.fronts.length === 0 && (
          <div className="alert">
            You own no fronts, so you are limited to {money(CONFIG.LAUNDER_NO_FRONT_CAP)} a week at
            a punishing {pct(CONFIG.LAUNDER_FLOOR_RATE)}. Buy a business on the Property page and
            both numbers improve sharply.
          </div>
        )}
        <div className="grid grid-2">
          <Field label="Through">
            <select value={frontId} onChange={(e) => setFrontId(e.target.value)}>
              <option value="">The street (no front)</option>
              {data.fronts.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.def?.name} — {pct(f.def?.rate)}, {money((f.def?.weeklyCapacity || 0) - (f.usedThisWeek || 0))} left this week
                </option>
              ))}
            </select>
          </Field>
          <Field label="Dirty money in">
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          </Field>
        </div>
        <p className="muted">
          {money(amt)} dirty → <strong className="money-clean">{money(Math.round(amt * rate))}</strong> clean
          <span className="faint"> ({pct(rate)} — the difference is what it costs to make it look ordinary)</span>
        </p>
        <button
          className="btn-brass"
          disabled={!amt || amt > me.dirty}
          onClick={() => act(
            () => api.bank.launder(amt, frontId || undefined),
            (r) => `Washed ${money(r.laundered)} into ${money(r.received)}.`
          ).then(() => { setAmount(''); load(); })}
        >
          Wash it
        </button>
      </Card>

      <Card title="Send money">
        <p className="faint tiny" style={{ marginTop: 0 }}>
          Kick-ups happen automatically each week. This is for everything else — bribes, tribute, paying a debt.
        </p>
        <div className="grid grid-2">
          <Field label="Who">
            <input
              value={send.q}
              onChange={async (e) => {
                setSend({ ...send, q: e.target.value, to: null });
                if (e.target.value.length >= 2) setFound(await api.player.search(e.target.value));
                else setFound([]);
              }}
              placeholder="username or name"
            />
          </Field>
          <Field label="Amount">
            <input type="number" value={send.amount} onChange={(e) => setSend({ ...send, amount: e.target.value })} />
          </Field>
        </div>
        <div className="row" style={{ marginBottom: 10 }}>
          <button className={`btn-sm ${send.kind === 'clean' ? 'btn-brass' : ''}`} onClick={() => setSend({ ...send, kind: 'clean' })}>Clean</button>
          <button className={`btn-sm ${send.kind === 'dirty' ? 'btn-brass' : ''}`} onClick={() => setSend({ ...send, kind: 'dirty' })}>Dirty</button>
        </div>
        {send.to ? (
          <div className="row">
            <span>To <strong>{fullName(send.to)}</strong></span>
            <button
              className="btn-primary btn-sm"
              onClick={() => act(
                () => api.bank.transfer(send.to.id, Number(send.amount || 0), send.kind),
                'Sent.'
              ).then(() => { setSend({ q: '', to: null, amount: '', kind: 'clean' }); load(); })}
            >
              Send {money(Number(send.amount || 0))}
            </button>
          </div>
        ) : found.length === 0 ? <Empty>Search for someone to pay.</Empty> : found.slice(0, 6).map((f) => (
          <div className="list-row" key={f.id}>
            <div style={{ flex: 1 }}>{fullName(f)} <span className="faint tiny">@{f.username}</span></div>
            <button className="btn-sm" onClick={() => setSend({ ...send, to: f, q: f.username })}>Choose</button>
          </div>
        ))}
      </Card>
    </>
  );
}
