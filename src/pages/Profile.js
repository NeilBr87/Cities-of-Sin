import React, { useState } from 'react';
import api from '../api';
import { useGame } from '../state/GameContext';
import { Card, Field, Loading, Badge } from '../components/ui';
import { fullName, money } from '../game/format';
import { rank, PATH_META } from '../game/ranks';
import { cityById, districtById } from '../game/world';

export default function Profile() {
  const { me, act } = useGame();
  const [form, setForm] = useState(null);

  if (!me) return <Loading />;
  const r = rank(me.rankId);
  const draft = form || {
    firstName: me.firstName, lastName: me.lastName, nickname: me.nickname || '',
    bio: me.bio || '', avatar: me.avatar || '',
  };
  const set = (k) => (e) => setForm({ ...draft, [k]: e.target.value });

  return (
    <>
      <h1>{fullName(me)}</h1>
      <p className="flavour" style={{ marginTop: -8 }}>@{me.username} · {PATH_META[me.path]?.label || 'Civilian'}</p>

      <div className="grid grid-2">
        <Card title="Public profile">
          <div className="grid grid-3">
            <Field label="First name"><input value={draft.firstName} onChange={set('firstName')} maxLength={20} /></Field>
            <Field label="Nickname"><input value={draft.nickname} onChange={set('nickname')} maxLength={20} /></Field>
            <Field label="Last name"><input value={draft.lastName} onChange={set('lastName')} maxLength={20} /></Field>
          </div>
          <p className="muted">Shown as <strong>{fullName(draft)}</strong></p>
          <Field label="Picture URL">
            <input value={draft.avatar} onChange={set('avatar')} placeholder="https://…" />
          </Field>
          {draft.avatar && (
            <img
              src={draft.avatar}
              alt=""
              style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', marginBottom: 12 }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          )}
          <Field label="Bio">
            <textarea value={draft.bio} onChange={set('bio')} rows={4} maxLength={400} />
          </Field>
          <button className="btn-brass" disabled={!form} onClick={() => act(() => api.player.updateProfile(draft), 'Profile saved.')}>
            Save
          </button>
        </Card>

        <Card title="Record">
          <div className="row" style={{ marginBottom: 12 }}>
            <Badge kind={me.path}>{r.label}</Badge>
            {me.family && <Badge>{me.family.logo} {me.family.name}</Badge>}
            {me.crew && <Badge>{me.crew.name}</Badge>}
            {me.party && <Badge kind="politician">{me.party.name}</Badge>}
            {me.department && <Badge kind="police">{me.department.name}</Badge>}
          </div>
          <div className="list-row"><span style={{ flex: 1 }}>Respect</span><span className="mono">{me.respect?.toLocaleString?.()}</span></div>
          <div className="list-row"><span style={{ flex: 1 }}>Clean money</span><span className="mono money-clean">{money(me.clean)}</span></div>
          <div className="list-row"><span style={{ flex: 1 }}>Dirty money</span><span className="mono money-dirty">{money(me.dirty)}</span></div>
          <div className="list-row"><span style={{ flex: 1 }}>Heat</span><span className="mono danger">{me.heat}</span></div>
          <div className="list-row"><span style={{ flex: 1 }}>Weekly salary</span><span className="mono">{money(r.salary)}</span></div>
          <div className="list-row">
            <span style={{ flex: 1 }}>Location</span>
            <span>{districtById(me.districtId)?.name}, {cityById(me.cityId)?.name}</span>
          </div>
          <p className="faint tiny" style={{ marginTop: 12, marginBottom: 0 }}>{r.blurb}</p>
        </Card>
      </div>
    </>
  );
}
