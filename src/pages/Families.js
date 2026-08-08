import React, { useCallback, useEffect, useState } from 'react';
import api from '../api';
import { useGame } from '../state/GameContext';
import { Card, Field, Empty, Loading, Badge } from '../components/ui';
import { money, fullName } from '../game/format';
import { CONFIG } from '../game/economy';
import { PATHS } from '../game/ranks';
import { cityById, CITIES } from '../game/world';

export default function Families() {
  const { me, act } = useGame();
  const [data, setData] = useState(null);
  const [cityFilter, setCityFilter] = useState('all');
  const [form, setForm] = useState({ name: '', motto: '', logo: '♠', colour: '#b4322c', cityId: me?.cityId || 'ny' });

  const load = useCallback(() => {
    api.families.list().then(setData).catch(() => setData({ families: [], citySlots: [] }));
  }, []);
  useEffect(load, [load]);

  if (!data) return <Loading what="Asking around" />;

  const slotFor = (cityId) => data.citySlots.find((s) => s.cityId === cityId);
  const openSomewhere = data.citySlots.some((s) => s.remaining > 0);
  const canFound = me?.path === PATHS.MAFIA && !me.familyId && openSomewhere;
  const shown = cityFilter === 'all'
    ? data.families
    : data.families.filter((f) => f.cityId === cityFilter);

  return (
    <>
      <h1>The Families</h1>
      <p className="flavour" style={{ marginTop: -8 }}>
        {data.maxPerCity} seats in every city, and never a sixth. A family starts in one city
        and buys its way into the others.
      </p>

      <Card title="Seats by city">
        <div className="grid grid-4">
          {data.citySlots.map((s) => (
            <div className="stat" key={s.cityId}>
              <div className="stat-label">{s.cityName}</div>
              <div className="stat-value">{s.used}/{data.maxPerCity}</div>
              <div className={`faint tiny ${s.remaining > 0 ? 'money-clean' : ''}`}>
                {s.remaining > 0 ? `${s.remaining} open` : 'full'}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="row" style={{ marginBottom: 14 }}>
        <button className={`btn-sm ${cityFilter === 'all' ? 'btn-brass' : ''}`} onClick={() => setCityFilter('all')}>
          All cities
        </button>
        {CITIES.map((c) => (
          <button key={c.id} className={`btn-sm ${cityFilter === c.id ? 'btn-brass' : ''}`} onClick={() => setCityFilter(c.id)}>
            {c.name}
          </button>
        ))}
      </div>

      <div className="grid grid-2">
        {shown.map((f) => (
          <Card key={f.id}>
            <div className="card-header">
              <h3 style={{ color: f.colour }}>{f.logo} {f.name}</h3>
              <Badge>{cityById(f.cityId)?.short}</Badge>
            </div>
            <p className="flavour" style={{ marginTop: 0 }}>{f.motto || '—'}</p>
            <div className="row tiny muted">
              <span>Boss: <strong>{f.boss ? fullName(f.boss) : 'vacant'}</strong></span>
              <span>{f.memberCount} members</span>
              <span>{f.crews} crews</span>
              <span>{f.racketCount} rackets</span>
            </div>
            {f.cities?.length > 1 && (
              <p className="faint tiny" style={{ marginTop: 6, marginBottom: 0 }}>
                Operating in {f.cities.map((c) => cityById(c)?.short).join(', ')}
              </p>
            )}
            {me?.path === PATHS.MAFIA && !me.familyId && (
              <button
                className="btn-sm"
                style={{ marginTop: 10 }}
                onClick={() => act(() => api.families.join(f.id), `You are an associate of the ${f.name} family.`).then(load)}
              >
                Sign on as an associate
              </button>
            )}
          </Card>
        ))}
      </div>

      {me?.familyId && (
        <Card>
          <p className="faint tiny" style={{ margin: 0 }}>
            You are already in a family. Leave it before joining another — and a boss cannot simply walk away.
          </p>
        </Card>
      )}

      {canFound && (
        <Card title="Found your own family">
          <p className="faint tiny" style={{ marginTop: 0 }}>
            First come, first served. It costs {money(CONFIG.FAMILY_FOUNDING_COST)} in clean money and makes you
            boss immediately. You have {money(me.clean)}.
          </p>
          <Field label="City">
            <select value={form.cityId} onChange={(e) => setForm({ ...form, cityId: e.target.value })}>
              {CITIES.map((c) => {
                const s = slotFor(c.id);
                return (
                  <option key={c.id} value={c.id} disabled={!s || s.remaining === 0}>
                    {c.name} — {s ? (s.remaining > 0 ? `${s.remaining} seat(s) open` : 'full') : ''}
                  </option>
                );
              })}
            </select>
          </Field>
          <div className="grid grid-2">
            <Field label="Family name">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={CONFIG.FAMILY_NAME_MAX} />
            </Field>
            <Field label="Logo">
              <input value={form.logo} onChange={(e) => setForm({ ...form, logo: e.target.value })} maxLength={4} />
            </Field>
          </div>
          <Field label="Motto">
            <input value={form.motto} onChange={(e) => setForm({ ...form, motto: e.target.value })} maxLength={80} />
          </Field>
          <Field label="Colour">
            <input type="color" value={form.colour} onChange={(e) => setForm({ ...form, colour: e.target.value })} />
          </Field>
          <button
            className="btn-brass"
            disabled={me.clean < CONFIG.FAMILY_FOUNDING_COST || form.name.length < 3 || (slotFor(form.cityId)?.remaining ?? 0) === 0}
            onClick={() => act(() => api.families.create(form), `The ${form.name} family is yours.`).then(load)}
          >
            {me.clean < CONFIG.FAMILY_FOUNDING_COST ? 'Not enough clean money' : 'Found the family'}
          </button>
        </Card>
      )}

      {!canFound && me?.path === PATHS.MAFIA && !me.familyId && !openSomewhere && (
        <Card><Empty>Every seat in every city is occupied. Join one, or wait for a boss to fall.</Empty></Card>
      )}
    </>
  );
}
