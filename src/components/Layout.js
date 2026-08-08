import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useGame } from '../state/GameContext';
import { PATHS, rank } from '../game/ranks';
import { cityById, districtById } from '../game/world';
import { fullName, money, duration } from '../game/format';
import { Meter, Badge, Alert } from './ui';
import { CONFIG } from '../game/economy';
import { USING_MOCK } from '../api/client';

function Item({ to, children, end }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
      {children}
    </NavLink>
  );
}

export default function Layout({ children }) {
  const { me, signOut, notice } = useGame();
  const navigate = useNavigate();
  if (!me) return null;

  const r = rank(me.rankId);
  const city = cityById(me.cityId);
  const district = districtById(me.districtId);
  const jailed = me.jailSecondsLeft > 0;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          Cities of Sin
          <small>{city?.short} · {r.label}</small>
        </div>

        <div className="nav-group-label">Street</div>
        <Item to="/" end>Dashboard</Item>
        {me.path === PATHS.MAFIA && <Item to="/crimes">Crimes</Item>}
        {me.path === PATHS.POLICE && <Item to="/duty">Duty</Item>}
        {me.path === PATHS.POLITICIAN && <Item to="/office">Office</Item>}
        <Item to="/district">District</Item>
        <Item to="/travel">Travel</Item>

        <div className="nav-group-label">Money</div>
        <Item to="/bank">Bank &amp; Laundering</Item>
        <Item to="/market">Market</Item>
        <Item to="/property">Property</Item>

        <div className="nav-group-label">Power</div>
        <Item to="/families">Families</Item>
        {me.familyId && <Item to="/family">My Family</Item>}
        <Item to="/politics">Politics</Item>
        <Item to="/police">Police</Item>

        <div className="nav-group-label">Life</div>
        <Item to="/prison">Prison</Item>
        <Item to="/chat">Chat</Item>
        <Item to="/leaderboard">Leaderboard</Item>
        <Item to="/profile">Profile</Item>

        <div className="spacer" />
        <button
          className="btn-ghost btn-sm"
          style={{ marginTop: 14 }}
          onClick={() => { signOut(); navigate('/'); }}
        >
          Sign out
        </button>
        {USING_MOCK && (
          <div className="faint tiny" style={{ padding: '8px 10px' }}>
            Mock backend — set REACT_APP_XANO_BASE to go live.
          </div>
        )}
      </aside>

      <div className="main">
        <header className="topbar">
          <div>
            <div className="faint tiny">{fullName(me)}</div>
            <div className="row" style={{ gap: 6 }}>
              <Badge kind={me.path}>{r.label}</Badge>
              {me.family && <Badge>{me.family.name}</Badge>}
              {jailed && <Badge kind="jail">In prison · {duration(me.jailSecondsLeft)}</Badge>}
            </div>
          </div>

          <div className="stat">
            <div className="stat-label">Clean</div>
            <div className="stat-value money">{money(me.clean)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Dirty</div>
            <div className="stat-value dirty">{money(me.dirty)}</div>
          </div>

          <div className="stat" style={{ minWidth: 120 }}>
            <div className="stat-label">Nerve {me.nerve}/{me.nerveMax}</div>
            <Meter value={me.nerve} max={me.nerveMax} kind="nerve" />
          </div>
          <div className="stat" style={{ minWidth: 120 }}>
            <div className="stat-label">Health {me.health}</div>
            <Meter value={me.health} max={CONFIG.HEALTH_MAX} kind="health" />
          </div>
          <div className="stat" style={{ minWidth: 120 }}>
            <div className="stat-label">Heat {me.heat}</div>
            <Meter value={me.heat} max={CONFIG.HEAT_MAX} kind="heat" />
          </div>

          <div className="spacer" />
          <div style={{ textAlign: 'right' }}>
            <div className="faint tiny">Location</div>
            <div>{district?.name}, {city?.short}</div>
          </div>
        </header>

        <main className="content">
          {notice && <Alert kind={notice.kind === 'error' ? 'error' : 'good'}>{notice.text}</Alert>}
          {children}
        </main>
      </div>
    </div>
  );
}
