import React, { useCallback, useEffect, useState } from 'react';
import api from '../api';
import { useGame } from '../state/GameContext';
import { Card, Field, Empty, Loading, Badge, ConfirmButton, Tabs } from '../components/ui';
import { money, fullName } from '../game/format';
import { PATHS, rank } from '../game/ranks';
import { CITIES, DISTRICTS } from '../game/world';

/** The structure of the force: departments, who runs them, and who to bribe. */
export default function Police() {
  const { me, act } = useGame();
  const [cityId, setCityId] = useState(me?.cityId || 'ny');
  const [tab, setTab] = useState('departments');
  const [depts, setDepts] = useState(null);
  const [families, setFamilies] = useState([]);
  const [create, setCreate] = useState({ name: '', motto: '', districtId: '' });
  const [bribe, setBribe] = useState({});

  const load = useCallback(() => {
    api.police.departments(cityId).then(setDepts).catch(() => setDepts([]));
    api.families.list().then((d) => setFamilies(d.families)).catch(() => setFamilies([]));
  }, [cityId]);
  useEffect(load, [load]);

  if (!me || !depts) return <Loading what="Pulling the duty roster" />;

  const isPolice = me.path === PATHS.POLICE;
  const myDept = depts.find((d) => String(d.id) === String(me.departmentId));
  const runsDept = myDept && String(myDept.lieutenantId) === String(me.id);
  const isChief = me.rankId === 'chief' && me.cityId === cityId;

  return (
    <>
      <h1>The Force</h1>
      <p className="flavour" style={{ marginTop: -8 }}>
        A chief per city, a lieutenant per district, and everybody else on the roster.
        Chiefs are appointed by the ranking politician — which is exactly as clean as it sounds.
      </p>

      <div className="row" style={{ marginBottom: 14 }}>
        {CITIES.map((c) => (
          <button
            key={c.id}
            className={`btn-sm ${cityId === c.id ? 'btn-brass' : ''}`}
            onClick={() => setCityId(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'departments', label: 'Departments' },
          ...(isPolice && ['lieutenant', 'chief'].includes(me.rankId) ? [{ id: 'manage', label: 'Command' }] : []),
          ...(me.path !== PATHS.POLICE ? [{ id: 'bribes', label: 'Bribes' }] : []),
        ]}
      />

      {tab === 'departments' && (
        <div className="grid grid-2">
          {depts.length === 0 && <Empty>No departments in this city.</Empty>}
          {depts.map((d) => (
            <Card key={d.id}>
              <div className="card-header">
                <h3>{d.name}</h3>
                <Badge kind="police">{d.size} badges</Badge>
              </div>
              <p className="flavour" style={{ marginTop: 0 }}>{d.motto || '—'}</p>
              <div className="faint tiny">
                {d.district?.name} · Lieutenant: {d.lieutenant ? fullName(d.lieutenant) : 'vacant'}
                {d.targetFamilyId && ` · targeting ${families.find((f) => String(f.id) === String(d.targetFamilyId))?.name || 'a family'}`}
              </div>
              {isPolice && String(me.departmentId) !== String(d.id) && (
                <button className="btn-sm" style={{ marginTop: 10 }} onClick={() => act(() => api.police.joinDepartment(d.id), `Assigned to ${d.name}.`).then(load)}>
                  Request assignment
                </button>
              )}
            </Card>
          ))}
        </div>
      )}

      {tab === 'manage' && (
        <>
          {runsDept && (
            <Card title={`Command — ${myDept.name}`}>
              <div className="grid grid-2">
                <Field label="Department name">
                  <input defaultValue={myDept.name} onChange={(e) => setCreate({ ...create, name: e.target.value })} />
                </Field>
                <Field label="Motto">
                  <input defaultValue={myDept.motto} onChange={(e) => setCreate({ ...create, motto: e.target.value })} />
                </Field>
              </div>
              <Field label="Target a family in this district">
                <select
                  defaultValue={myDept.targetFamilyId || ''}
                  onChange={(e) => act(() => api.police.updateDepartment(myDept.id, { targetFamilyId: e.target.value || null }), 'Target set.').then(load)}
                >
                  <option value="">No target</option>
                  {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </Field>
              <div className="row">
                <button
                  className="btn-brass"
                  onClick={() => act(() => api.police.updateDepartment(myDept.id, { name: create.name || myDept.name, motto: create.motto ?? myDept.motto }), 'Saved.').then(load)}
                >
                  Save
                </button>
                <div className="spacer" />
                <ConfirmButton
                  className="btn-primary"
                  confirmLabel="Disband the department?"
                  onConfirm={() => act(() => api.police.deleteDepartment(myDept.id), 'Disbanded.').then(load)}
                >
                  Disband
                </ConfirmButton>
              </div>
              <hr />
              <h3>Roster</h3>
              <DeptRoster deptId={myDept.id} onKick={(pid) => act(() => api.police.kickFromDepartment(pid), 'Off the roster.').then(load)} />
            </Card>
          )}

          {!runsDept && ['lieutenant', 'chief'].includes(me.rankId) && (
            <Card title="Start a department">
              <div className="grid grid-2">
                <Field label="Name"><input value={create.name} onChange={(e) => setCreate({ ...create, name: e.target.value })} placeholder="Red Hook Organised Crime Unit" /></Field>
                <Field label="District">
                  <select value={create.districtId} onChange={(e) => setCreate({ ...create, districtId: e.target.value })}>
                    <option value="">Choose…</option>
                    {DISTRICTS.filter((d) => d.cityId === cityId).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Motto"><input value={create.motto} onChange={(e) => setCreate({ ...create, motto: e.target.value })} /></Field>
              <button className="btn-brass" disabled={!create.districtId} onClick={() => act(() => api.police.createDepartment(create), 'Department stood up.').then(load)}>
                Create
              </button>
            </Card>
          )}

          {isChief && (
            <Card title="Chief's prerogative">
              <p className="faint tiny" style={{ marginTop: 0 }}>
                You can strip a lieutenant of their command. You cannot appoint your own successor — that is
                the mayor's job, or the president's.
              </p>
              {depts.filter((d) => d.lieutenant).map((d) => (
                <div className="list-row" key={d.id}>
                  <div style={{ flex: 1 }}>{fullName(d.lieutenant)} — {d.name}</div>
                  <ConfirmButton className="btn-sm" onConfirm={() => act(() => api.police.kickFromDepartment(d.lieutenantId), 'Busted down to officer.').then(load)}>
                    Relieve of command
                  </ConfirmButton>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {tab === 'bribes' && (
        <Card title="Envelopes">
          <p className="faint tiny" style={{ marginTop: 0 }}>
            Dirty money to an officer buys heat off your record. It also puts dirty money in their pocket,
            which is its own kind of leverage later.
          </p>
          <BribeList cityId={cityId} bribe={bribe} setBribe={setBribe} act={act} />
        </Card>
      )}
    </>
  );
}

function DeptRoster({ deptId, onKick }) {
  const [dept, setDept] = useState(null);
  useEffect(() => { api.police.department(deptId).then(setDept).catch(() => setDept(null)); }, [deptId]);
  if (!dept) return <Loading />;
  if (!dept.officers?.length) return <Empty>Nobody assigned.</Empty>;
  return dept.officers.map((o) => (
    <div className="list-row" key={o.id}>
      <div style={{ flex: 1 }}>
        {fullName(o)} <span className="faint tiny">{rank(o.rankId).label}</span>
      </div>
      {o.rankId !== 'lieutenant' && (
        <ConfirmButton className="btn-sm" onConfirm={() => onKick(o.id)}>Remove</ConfirmButton>
      )}
    </div>
  ));
}

function BribeList({ cityId, bribe, setBribe, act }) {
  const [officers, setOfficers] = useState([]);
  useEffect(() => {
    api.player.search('').then((all) => setOfficers(all.filter((p) => p.path === PATHS.POLICE && p.cityId === cityId)));
  }, [cityId]);
  if (!officers.length) return <Empty>No officers on the street here.</Empty>;
  return officers.slice(0, 15).map((o) => (
    <div className="list-row" key={o.id}>
      <div style={{ flex: 1 }}>
        <div>{fullName(o)}</div>
        <div className="faint tiny">{rank(o.rankId).label}</div>
      </div>
      <input
        type="number"
        style={{ width: 130 }}
        placeholder="amount"
        value={bribe[o.id] || ''}
        onChange={(e) => setBribe({ ...bribe, [o.id]: e.target.value })}
      />
      <button
        className="btn-sm"
        onClick={() => act(
          () => api.police.offerBribe(o.id, Number(bribe[o.id] || 0)),
          (r) => `Envelope delivered. Heat down ${r.heatRemoved}.`
        )}
      >
        Pay {bribe[o.id] ? money(Number(bribe[o.id])) : ''}
      </button>
    </div>
  ));
}
