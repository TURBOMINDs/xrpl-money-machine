export const formatXRP = (n) => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  const v = Number(n);
  if (v === 0) return '0';
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(2)}K`;
  if (Math.abs(v) < 0.01) return v.toExponential(2);
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

export const formatUSD = (n) => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  const v = Number(n);
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(2)}K`;
  if (Math.abs(v) < 0.0001) return `$${v.toExponential(2)}`;
  if (Math.abs(v) < 1) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(2)}`;
};

export const shortAddr = (a = '') => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

export const timeAgo = (iso) => {
  if (!iso) return '';
  const d = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.floor((now - d) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86_400)}d ago`;
};

export const DEMO_ADDRESSES = [
  'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY',
  'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
  'rBithomp9gLhVqd5o8r9GJG7HZtJkYJBEa',
];

export const DEMO_AMM_LPS = [
  'rHUpaqUPbwzKZdzQ8ZQCme18FrgW9pB4am', // XRP/USD bitstamp AMM (discovered via POC)
];
