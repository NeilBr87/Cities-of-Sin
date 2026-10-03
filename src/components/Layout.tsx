import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useSession } from '../state/SessionProvider';
import { Meter } from './ui';
import { duration, shortMoney } from '../lib/format';
import { rankOf } from '../lib/ranks';

const NAV = [
  {
    group: 'The Street',
    items: [
      { to: '/app', label: 'Dashboard', icon: '◆', end: true },
      { to: '/app/crimes', label: 'Crimes', icon: '✦' },
      { to: '/app/district', label: 'District', icon: '▣' },
      { to: '/app/rackets', label: 'Rackets', icon: '◫' },
      { to: '/app/travel', label: 'Travel', icon: '✈' },
    ],
  },
  {
    group: 'The Family',
    items: [
      { to: '/app/families', label: 'Families', icon: '※' },
      { to: '/app/family', label: 'My Family', icon: '☗' },
    ],
  },
  {
    group: 'Business',
    items: [
      { to: '/app/bank', label: 'Bank', icon: '$' },
      { to: '/app/prison', label: 'Prison', icon: '▤' },
    ],
  },
  {
    group: 'People',
    items: [
      { to: '/app/chat', label: 'Chat', icon: '❝' },
      { to: '/app/leaderboard', label: 'Standing', icon: '≡' },
      { to: '/app/profile', label: 'Profile', icon: '◈' },
    ],
  },
];

// Shown greyed out so playtesters can see where this is going.
const SOON = ['Politics', 'Police'];

export default function Layout({ children }: { children: ReactNode }) {
  const { me, signOut } = useSession();
  const c = me?.character;
  if (!c) return null;

  const r = rankOf(c.rank_id);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">Cities of <span>Sin</span></div>
          <div className="brand-sub">{me.city?.name ?? '—'}</div>
        </div>

        <nav className="nav">
          {NAV.map((g) => (
            <div className="nav-group" key={g.group}>
              <span className="label">{g.group}</span>
              {g.items.map((i) => (
                <NavLink
                  key={i.to}
                  to={i.to}
                  end={i.end}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  <span className="nav-icon" aria-hidden>{i.icon}</span>
                  {i.label}
                  {i.label === 'Prison' && c.jailed && (
                    <span className="nav-tag">{duration(c.jail_seconds_left)}</span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}

          <div className="nav-group">
            <span className="label">Not built yet</span>
            {SOON.map((s) => (
              <span key={s} className="nav-link" style={{ opacity: 0.32, cursor: 'default' }}>
                <span className="nav-icon" aria-hidden>·</span>
                {s}
              </span>
            ))}
          </div>
        </nav>

        <div className="sidebar-foot">
          <div className="between">
            <span>{me.profile.username}</span>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => void signOut()}>
              Out
            </button>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-stat">
            <span className="stat-label">Clean</span>
            <span className="v" style={{ color: 'var(--clean)' }}>{shortMoney(c.clean)}</span>
          </div>
          <div className="topbar-stat">
            <span className="stat-label">Dirty</span>
            <span className="v" style={{ color: 'var(--dirty)' }}>{shortMoney(c.dirty)}</span>
          </div>
          <div className="topbar-stat" style={{ minWidth: 86 }}>
            <span className="stat-label">Nerve {c.nerve}/{c.nerve_max}</span>
            <Meter value={c.nerve} max={c.nerve_max} kind="nerve" />
          </div>
          <div className="topbar-stat" style={{ minWidth: 86 }}>
            <span className="stat-label">Heat {Math.round(c.heat)}</span>
            <Meter value={c.heat} max={100} kind="heat" />
          </div>
          <div className="topbar-stat" style={{ minWidth: 86 }}>
            <span className="stat-label">Health {c.health}</span>
            <Meter value={c.health} max={100} kind="health" />
          </div>

          <div className="grow" />

          <div className="topbar-stat right" style={{ textAlign: 'right' }}>
            <span className="stat-label">{r.label}</span>
            <span className="v">{c.display_name}</span>
          </div>
        </header>

        <main className="page">{children}</main>
      </div>
    </div>
  );
}
