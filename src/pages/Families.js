import React, { useCallback, useEffect, useState } from 'react';
import api from '../api';
import { useGame } from '../state/GameContext';
import { Card, Field, Empty, Loading, Badge } from '../components/ui';
import { money, fullName } from '../game/format';
import { CONFIG } from '../game/economy';
import { PATHS } from '../game/ranks';
import { cityById } from '../game/world';

export default function Families() {
  const { me, act } = useGame();
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ name: '', motto: '', logo: '♠', colour: '#b4322c' });

  const load = useCallback(() => {
    api.families.list().then(setData).catch(() => setData({ families: [], slotsRemaining: 0 }));
  }, []);
  useEffect(load, [load]);

  if (!data) return <Loading what="Asking around" />;

  const canFound =
    me?.path === PATHS.MAFIA && !me.familyId && data.slotsRemaining > 0;

  return (
    <>
      <h1>The Families</h1>
      <p className="flavour" style={{ marginTop: -8 }}>
        There are five seats at the table and never a sixth. {data.slotsRemaining > 0
          ? `${data.slotsRemaining} of them are empty right now.`
          : 'All five are taken — somebody has to fall before you can rise.'}
      </p>

      <div className="grid grid-2">
        {data.families.map((f) => (
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
              <span>{f.respect?.toLocaleString?.() ?? f.respect} respect</span>
            </div>
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
            disabled={me.clean < CONFIG.FAMILY_FOUNDING_COST || form.name.length < 3}
            onClick={() => act(() => api.families.create(form), `The ${form.name} family is yours.`).then(load)}
          >
            {me.clean < CONFIG.FAMILY_FOUNDING_COST ? 'Not enough clean money' : 'Found the family'}
          </button>
        </Card>
      )}

      {!canFound && me?.path === PATHS.MAFIA && !me.familyId && data.slotsRemaining === 0 && (
        <Card><Empty>All five seats are occupied. Join one, or wait for a boss to fall.</Empty></Card>
      )}
    </>
  );
}
