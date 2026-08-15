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
  // The page is scoped to one city at a time, and opens on the one you are
  // standing in. Families are a city-level institution now — a global list
  // mixes twenty families across four cities into noise.
  const [cityId, setCityId] = useState(me?.cityId || 'ny');
  const [form, setForm] = useState({ name: '', motto: '', logo: '♠', colour: '#b4322c', cityId: me?.cityId || 'ny' });

  const load = useCallback(() => {
    api.families.list().then(setData).catch(() => setData({ families: [], citySlots: [] }));
  }, []);
  useEffect(load, [load]);

  if (!data) return <Loading what="Asking around" />;

  const slotFor = (cityId) => data.citySlots.find((s) => s.cityId === cityId);
  const openSomewhere = data.citySlots.some((s) => s.remaining > 0);
  const canFound = me?.path === PATHS.MAFIA && !me.familyId;
  const city = cityById(cityId);
  const slots = slotFor(cityId);
  const shown = data.families.filter((f) => f.cityId === cityId);
  // Families headquartered elsewhere that have expanded into this city.
  const visiting = data.families.filter(
    (f) => f.cityId !== cityId && (f.cities || []).includes(cityId)
  );

  return (
    <>
      <h1>The Families of {city?.name}</h1>
      <p className="flavour" style={{ marginTop: -8 }}>{city?.tagline}</p>

      <div className="row" style={{ marginBottom: 14 }}>
        {CITIES.map((c) => {
          const s = slotFor(c.id);
          return (
            <button
              key={c.id}
              className={`btn-sm ${cityId === c.id ? 'btn-brass' : ''}`}
              onClick={() => setCityId(c.id)}
            >
              {c.name}
              <span className="faint tiny" style={{ marginLeft: 6 }}>
                {s ? `${s.used}/${data.maxPerCity}` : ''}
              </span>
            </button>
          );
        })}
      </div>

      <Card>
        <div className="row-between">
          <div>
            <div className="stat-label">Seats at the table</div>
            <div className="stat-value">{slots?.used ?? 0} of {data.maxPerCity} taken</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className={`stat-value ${slots?.remaining > 0 ? 'money' : 'heat'}`}>
              {slots?.remaining > 0 ? `${slots.remaining} open` : 'Full'}
            </div>
            <div className="faint tiny">
              {slots?.remaining > 0
                ? 'Somebody could found one today'
                : 'A boss has to fall before anyone else sits down'}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-2">
        {shown.length === 0 && (
          <Empty>Nobody has founded a family in {city?.name} yet. All {data.maxPerCity} seats are open.</Empty>
        )}
        {shown.map((f) => (
          <Card key={f.id}>
            <div className="card-header">
              <h3 style={{ color: f.colour }}>{f.logo} {f.name}</h3>
              <Badge>{f.racketCount} rackets</Badge>
            </div>
            <p className="flavour" style={{ marginTop: 0 }}>{f.motto || '—'}</p>
            <div className="row tiny muted">
              <span>Boss: <strong>{f.boss ? fullName(f.boss) : 'vacant'}</strong></span>
              <span>{f.memberCount} members</span>
              <span>{f.crews} crews</span>
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

      {visiting.length > 0 && (
        <Card title={`Also operating in ${city?.name}`}>
          <p className="faint tiny" style={{ marginTop: 0 }}>
            Headquartered elsewhere, but they have paid to open here — so they can plant crews
            and take rackets in this city too.
          </p>
          {visiting.map((f) => (
            <div className="list-row" key={f.id}>
              <div style={{ flex: 1 }}>
                <div style={{ color: f.colour }}>{f.logo} {f.name}</div>
                <div className="faint tiny">
                  Out of {cityById(f.cityId)?.name} · {f.racketCount} rackets
                </div>
              </div>
              <Badge>{cityById(f.cityId)?.short}</Badge>
            </div>
          ))}
        </Card>
      )}

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
            You are taking one of <strong>{city?.name}</strong>'s {data.maxPerCity} seats — switch cities above
            to found somewhere else. It costs {money(CONFIG.FAMILY_FOUNDING_COST)} in clean money and makes you
            boss immediately. You have {money(me.clean)}.
          </p>
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
            disabled={me.clean < CONFIG.FAMILY_FOUNDING_COST || form.name.length < 3 || (slots?.remaining ?? 0) === 0}
            onClick={() => act(() => api.families.create({ ...form, cityId }), `The ${form.name} family is yours.`).then(load)}
          >
            {(slots?.remaining ?? 0) === 0 ? `${city?.name} is full`
              : me.clean < CONFIG.FAMILY_FOUNDING_COST ? 'Not enough clean money'
                : `Found the family in ${city?.name}`}
          </button>
        </Card>
      )}

      {me?.path === PATHS.MAFIA && !me.familyId && !openSomewhere && (
        <Card><Empty>Every seat in every city is occupied. Join one, or wait for a boss to fall.</Empty></Card>
      )}
    </>
  );
}
