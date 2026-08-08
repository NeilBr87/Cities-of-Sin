import React, { useEffect, useState } from 'react';
import { money, duration } from '../game/format';

export function Card({ title, action, children, className = '' }) {
  return (
    <div className={`card ${className}`}>
      {(title || action) && (
        <div className="card-header">
          {title && <h3>{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function Stat({ label, value, tone, sub }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${tone || ''}`}>{value}</div>
      {sub && <div className="faint tiny">{sub}</div>}
    </div>
  );
}

export function Meter({ value, max, kind }) {
  const p = Math.max(0, Math.min(100, ((value || 0) / (max || 1)) * 100));
  return (
    <div className={`meter ${kind || ''}`}>
      <span style={{ width: `${p}%` }} />
    </div>
  );
}

export function Badge({ children, kind }) {
  return <span className={`badge ${kind || ''}`}>{children}</span>;
}

export function Alert({ children, kind }) {
  if (!children) return null;
  return <div className={`alert ${kind || ''}`}>{children}</div>;
}

export function Money({ value, dirty }) {
  return <span className={dirty ? 'money-dirty' : 'money-clean'}>{money(value)}</span>;
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <div
          key={t.id}
          className={`tab ${active === t.id ? 'active' : ''}`}
          onClick={() => onChange(t.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onChange(t.id)}
        >
          {t.label}
        </div>
      ))}
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

export function Empty({ children }) {
  return <div className="faint" style={{ padding: '18px 0' }}>{children}</div>;
}

export function Loading({ what = 'Loading' }) {
  return <div className="faint" style={{ padding: '18px 0' }}>{what}…</div>;
}

/** A live countdown that ticks itself down each second. */
export function Countdown({ seconds, onDone }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => setLeft(seconds), [seconds]);
  useEffect(() => {
    if (left <= 0) return undefined;
    const t = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          if (onDone) onDone();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // onDone is intentionally excluded — it is usually an inline closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left > 0]);
  if (left <= 0) return null;
  return <span className="mono">{duration(left)}</span>;
}

export function ConfirmButton({ children, onConfirm, confirmLabel = 'Sure?', ...rest }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      {...rest}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}
