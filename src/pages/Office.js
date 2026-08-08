import React, { useCallback, useEffect, useState } from 'react';
import api from '../api';
import { useGame } from '../state/GameContext';
import { Card, Field, Empty, Loading, Badge, Tabs } from '../components/ui';
import { money, fullName } from '../game/format';
import { rank } from '../game/ranks';
import { CITIES, DISTRICTS, districtById } from '../game/world';

const LAW_CATEGORIES = [
  { id: 'petty', label: 'Petty theft' },
  { id: 'violent', label: 'Violent crime' },
  { id: 'narcotics', label: 'Narcotics' },
  { id: 'racketeering', label: 'Racketeering' },
  { id: 'gambling', label: 'Gambling' },
];

const CONTRACT_KINDS = ['construction', 'sanitation', 'union', 'gaming', 'publicworks'];

/** Where a politician spends the power they were elected with. */
export default function Office() {
  const { me, act } = useGame();
  const [tab, setTab] = useState('contracts');
  const [offices, setOffices] = useState([]);
  const [laws, setLaws] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [families, setFamilies] = useState([]);
  const [inmates, setInmates] = useState([]);
  const [award, setAward] = useState({ kind: 'construction', districtId: '', familyId: '', value: 50000, title: '' });

  const load = useCallback(() => {
    api.politics.offices().then(setOffices).catch(() => setOffices([]));
    api.politics.laws().then(setLaws).catch(() => setLaws([]));
    api.politics.contracts().then(setContracts).catch(() => setContracts([]));
    api.families.list().then((d) => setFamilies(d.families)).catch(() => setFamilies([]));
    if (me) api.prison.inmates(me.cityId).then(setInmates).catch(() => setInmates([]));
  }, [me]);
  useEffect(load, [load]);

  if (!me) return <Loading />;

  const myOffice = offices.find((o) => String(o.holderId) === String(me.id));
  const r = rank(me.rankId);

  if (!myOffice) {
    return (
      <>
        <h1>Office</h1>
        <Card>
          <Empty>
            You hold no office. You are a {r.label} on {money(r.salary)} a week.
            Stand for a seat on the <a href="#/politics">Politics</a> page — councilman races run every week,
            so the ladder moves fast.
          </Empty>
        </Card>
      </>
    );
  }

  const reach = myOffice.seat; // 'district' | 'city' | 'nation'
  const districtOptions = reach === 'nation' ? DISTRICTS
    : reach === 'city' ? DISTRICTS.filter((d) => d.cityId === myOffice.scopeId)
      : DISTRICTS.filter((d) => d.id === myOffice.scopeId);
  const ceiling = reach === 'district' ? 60000 : reach === 'city' ? 400000 : 1500000;

  return (
    <>
      <h1>{r.label} of {myOffice.scopeName}</h1>
      <p className="flavour" style={{ marginTop: -8 }}>{r.blurb}</p>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'contracts', label: 'Contracts' },
          ...(reach !== 'district' ? [{ id: 'laws', label: 'The law' }, { id: 'pardons', label: 'Pardons' }] : []),
          { id: 'police', label: 'Police directive' },
        ]}
      />

      {tab === 'contracts' && (
        <>
          <Card title="Award a contract">
            <p className="faint tiny" style={{ marginTop: 0 }}>
              A contract is what turns a family into a business. It unlocks the tier-3 project crimes for whoever
              holds it, and 20% of the value lands in their treasury immediately. Your ceiling is {money(ceiling)}.
            </p>
            <div className="grid grid-2">
              <Field label="District">
                <select value={award.districtId} onChange={(e) => setAward({ ...award, districtId: e.target.value, title: districtById(e.target.value)?.contracts || '' })}>
                  <option value="">Choose…</option>
                  {districtOptions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>
              <Field label="Family">
                <select value={award.familyId} onChange={(e) => setAward({ ...award, familyId: e.target.value })}>
                  <option value="">Choose…</option>
                  {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </Field>
              <Field label="Kind">
                <select value={award.kind} onChange={(e) => setAward({ ...award, kind: e.target.value })}>
                  {CONTRACT_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </Field>
              <Field label={`Value (max ${money(ceiling)})`}>
                <input type="number" value={award.value} onChange={(e) => setAward({ ...award, value: Number(e.target.value) })} />
              </Field>
            </div>
            <Field label="Title">
              <input value={award.title} onChange={(e) => setAward({ ...award, title: e.target.value })} placeholder="Esplanade waterfront project" />
            </Field>
            <button
              className="btn-brass"
              disabled={!award.districtId || !award.familyId}
              onClick={() => act(() => api.politics.awardContract(award), 'Contract awarded.').then(load)}
            >
              Award it
            </button>
          </Card>

          <Card title="Live contracts">
            {contracts.length === 0 ? <Empty>Nothing awarded yet.</Empty> : contracts.map((c) => (
              <div className="list-row" key={c.id}>
                <div style={{ flex: 1 }}>
                  <div>{c.title} <Badge>{c.kind}</Badge></div>
                  <div className="faint tiny">
                    {c.district?.name} · {money(c.value)} · to the {c.family?.name || '—'} family
                    {c.awardedBy && ` · awarded by ${fullName(c.awardedBy)}`}
                  </div>
                </div>
              </div>
            ))}
          </Card>
        </>
      )}

      {tab === 'laws' && reach !== 'district' && (
        <Card title={reach === 'nation' ? 'Federal law' : `${myOffice.scopeName} city law`}>
          <p className="faint tiny" style={{ marginTop: 0 }}>
            The sentence multiplier scales how long a conviction in that category costs. Federal law overrides
            city law. Sentences are always clamped so nobody sits out an entire weekend.
          </p>
          {LAW_CATEGORIES.map((cat) => {
            const existing = laws.find((l) => l.category === cat.id && (reach === 'nation' ? l.scope === 'nation' : l.scope === 'city' && l.scopeId === myOffice.scopeId));
            return (
              <div className="list-row" key={cat.id}>
                <div style={{ flex: 1 }}>
                  <div>{cat.label}</div>
                  <div className="faint tiny">
                    Currently ×{existing?.sentenceMultiplier ?? 1} · {existing?.legal ? 'legal' : 'illegal'}
                  </div>
                </div>
                <input
                  type="number" step="0.25" min="0.25" max="4"
                  style={{ width: 90 }}
                  defaultValue={existing?.sentenceMultiplier ?? 1}
                  onBlur={(e) => act(
                    () => api.politics.setLaw({ category: cat.id, sentenceMultiplier: Number(e.target.value), legal: existing?.legal ?? false }),
                    `${cat.label} sentencing updated.`
                  ).then(load)}
                />
                <button
                  className="btn-sm"
                  onClick={() => act(
                    () => api.politics.setLaw({ category: cat.id, sentenceMultiplier: existing?.sentenceMultiplier ?? 1, legal: !(existing?.legal) }),
                    `${cat.label} is now ${existing?.legal ? 'illegal' : 'legal'}.`
                  ).then(load)}
                >
                  Make {existing?.legal ? 'illegal' : 'legal'}
                </button>
              </div>
            );
          })}
        </Card>
      )}

      {tab === 'pardons' && reach !== 'district' && (
        <Card title="Pardons">
          <p className="faint tiny" style={{ marginTop: 0 }}>
            {reach === 'nation'
              ? 'You can pardon anyone, anywhere, for anything.'
              : `You can pardon anyone held in ${myOffice.scopeName}.`}
          </p>
          {inmates.length === 0 ? <Empty>The cells are empty.</Empty> : inmates.map((i) => (
            <div className="list-row" key={i.id}>
              <div style={{ flex: 1 }}>
                <div>{fullName(i)} <span className="faint tiny">@{i.username}</span></div>
                <div className="faint tiny">{rank(i.rankId).label} · {Math.round(i.secondsLeft / 60)}m left</div>
              </div>
              <button className="btn-sm" onClick={() => act(() => api.politics.pardon(i.id), 'Pardoned.').then(load)}>
                Pardon
              </button>
            </div>
          ))}
        </Card>
      )}

      {tab === 'police' && (
        <Card title="Point the police at a family">
          <p className="faint tiny" style={{ marginTop: 0 }}>
            A directive tells every officer in scope whose crimes to work first. A president's directive
            overrides a mayor's, which overrides a chief's.
          </p>
          <div className="grid grid-2">
            <Field label="Scope">
              <select
                defaultValue={myOffice.seat === 'nation' ? CITIES[0].id : myOffice.scopeId}
                onChange={(e) => setAward({ ...award, scopeId: e.target.value })}
              >
                {(reach === 'nation' ? CITIES : CITIES.filter((c) => c.id === myOffice.scopeId || reach === 'district')).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Target family">
              <select value={award.familyId} onChange={(e) => setAward({ ...award, familyId: e.target.value })}>
                <option value="">No target</option>
                {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </Field>
          </div>
          <button
            className="btn-primary"
            onClick={() => act(
              () => api.politics.directPolice(award.familyId || null, award.scopeId || myOffice.scopeId),
              'Directive issued.'
            )}
          >
            Issue the directive
          </button>
        </Card>
      )}
    </>
  );
}
