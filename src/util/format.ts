// Number formatting — ported from the original game (fmtNum).

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

export function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return n > 0 ? '∞' : n < 0 ? '-∞' : 'NaN';
  if (n < 0) return '-' + fmtNum(-n);
  if (n < 1000) {
    if (n === 0) return '0';
    if (n < 10) return n.toFixed(2);
    if (n < 100) return n.toFixed(1);
    return Math.floor(n).toString();
  }
  const tier = Math.floor(Math.log10(n) / 3);
  if (tier >= SUFFIXES.length) return n.toExponential(2).replace('e+', 'e');
  const scaled = n / Math.pow(1000, tier);
  const body =
    scaled < 10 ? scaled.toFixed(2) : scaled < 100 ? scaled.toFixed(1) : Math.floor(scaled).toString();
  return body + SUFFIXES[tier];
}

/** Integer-first formatting for Echo counts (always whole numbers). */
export function fmtInt(n: number): string {
  return n < 1000 ? String(Math.round(n)) : fmtNum(n);
}

export function fmtTime(sec: number): string {
  if (sec < 60) return `${Math.floor(sec)}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${Math.floor(sec % 60)}s`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  return `${Math.floor(sec / 86400)}d ${Math.floor((sec % 86400) / 3600)}h`;
}
