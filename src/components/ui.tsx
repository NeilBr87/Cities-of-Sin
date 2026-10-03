import type { ReactNode } from 'react';
import { money as fmtMoney } from '../lib/format';

export function Card({
  title, action, children, className = '', flush = false,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <div className={`card ${flush ? 'card-flush' : ''} ${className}`}>
      {(title || action) && (
        <div className="card-header" style={flush ? { padding: '14px 16px 10px', margin: 0 } : undefined}>
          {title ? <h3>{title}</h3> : <span />}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function Stat({
  label, value, tone, sub,
}: {
  label: string;
  value: ReactNode;
  tone?: 'clean' | 'dirty' | 'heat' | 'nerve';
  sub?: ReactNode;
}) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${tone ?? ''}`}>{value}</div>
      {sub && <div className="faint tiny">{sub}</div>}
    </div>
  );
}

export function Meter({
  value, max, kind,
}: {
  value: number;
  max: number;
  kind?: 'heat' | 'nerve' | 'health';
}) {
  const p = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  return (
    <div className={`meter ${kind ?? ''}`} role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <span style={{ width: `${p}%` }} />
    </div>
  );
}

export function Badge({ children, kind }: { children: ReactNode; kind?: string }) {
  return <span className={`badge ${kind ?? ''}`}>{children}</span>;
}

export function Alert({ children, kind }: { children?: ReactNode; kind?: 'error' | 'good' | 'warn' }) {
  if (!children) return null;
  return <div className={`alert ${kind ?? ''}`}>{children}</div>;
}

export function Money({ value, dirty }: { value: number; dirty?: boolean }) {
  return <span className={dirty ? 'money-dirty' : 'money-clean'}>{fmtMoney(value)}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="loading">
      <span className="spinner" />
      <span>{label}…</span>
    </div>
  );
}

export function Tabs<T extends string>({
  tabs, active, onChange,
}: {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={active === t.id}
          className={`tab ${active === t.id ? 'active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Field({
  label, hint, error, children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      {children}
      {hint && !error && <div className="faint tiny" style={{ marginTop: 4 }}>{hint}</div>}
      {error && <div className="field-error">{error}</div>}
    </label>
  );
}
