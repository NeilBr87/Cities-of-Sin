export function money(n) {
  const v = Math.round(n || 0);
  return '$' + v.toLocaleString('en-US');
}

export function shortMoney(n) {
  const v = Math.abs(n || 0);
  if (v >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (v >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (v >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(Math.round(n || 0));
}

export function duration(seconds) {
  const s = Math.max(0, Math.round(seconds || 0));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 ? `${m}m ${s % 60}s` : `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d}d ${h % 24}h` : `${d}d`;
}

export function pct(n) {
  return `${Math.round((n || 0) * 100)}%`;
}

export function timeAgo(iso) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Math.max(0, (Date.now() - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/** Johnny 'The Boy' Smith */
export function fullName(p) {
  if (!p) return 'Unknown';
  const nick = p.nickname ? ` '${p.nickname}' ` : ' ';
  return `${p.firstName || ''}${nick}${p.lastName || ''}`.replace(/\s+/g, ' ').trim();
}

/** Genovese crew — a crew takes the captain's surname. */
export function crewName(captain) {
  return captain?.lastName ? `${captain.lastName} Crew` : 'Unnamed Crew';
}
