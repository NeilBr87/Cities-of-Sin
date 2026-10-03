export function money(n: number | null | undefined): string {
  return '$' + Math.round(n ?? 0).toLocaleString('en-US');
}

export function shortMoney(n: number | null | undefined): string {
  const v = Math.abs(n ?? 0);
  const sign = (n ?? 0) < 0 ? '-' : '';
  if (v >= 1e9) return `${sign}$${(v / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
  if (v >= 1e6) return `${sign}$${(v / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (v >= 1e4) return `${sign}$${(v / 1e3).toFixed(0)}K`;
  return money(n);
}

export function duration(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.round(seconds ?? 0));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 ? `${m}m ${s % 60}s` : `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d}d ${h % 24}h` : `${d}d`;
}

export function pct(n: number | null | undefined): string {
  return `${Math.round((n ?? 0) * 100)}%`;
}

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Math.max(0, (Date.now() - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function clockTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Johnny 'The Boy' Smith — for rows that carry name parts rather than a display_name. */
export function nameOf(p: {
  first_name: string;
  nickname?: string | null;
  last_name: string;
}): string {
  const nick = p.nickname ? ` '${p.nickname}' ` : ' ';
  return `${p.first_name}${nick}${p.last_name}`.replace(/\s+/g, ' ').trim();
}
