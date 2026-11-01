// Your seven rules as code. The limits are fixed here (edit the numbers if your plan changes).
export const LIMITS = { maxLoss: 120, targetMin: 350, targetMax: 400, maxLossTrades: 2, expiryNearDays: 1 };

export const istDate = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);

export function marketOpen(now = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(now).map((x) => [x.type, x.value])
  );
  const mins = (Number(p.hour) % 24) * 60 + Number(p.minute);
  return !['Sat', 'Sun'].includes(p.weekday) && mins >= 555 && mins <= 930; // 9:15 - 15:30 IST
}

const num = (v) => (v === '' || v == null ? NaN : Number(v));
const r2 = (x) => Math.round(x * 100) / 100;
export const sum = (arr, k) => arr.reduce((s, x) => s + (Number(x[k]) || 0), 0);

// Every rule is a tick box the trader answers honestly.
export const RULES = [
  { id: 'slPlaced', rule: 7, label: () => 'Stop loss placed before entry' },
  { id: 'lossOk', rule: 1, label: (L) => `Exited within the max loss (₹${L.maxLoss}, before tax)` },
  { id: 'confirm5m', rule: 3, label: () => 'Entered after 5 min confirmation' },
  { id: 'srLevel', rule: 3, label: () => 'Entry at a strong support or resistance' },
  { id: 'expiryOk', rule: 4, label: () => 'Expiry not too close (or took the next expiry)', fnoOnly: true },
  { id: 'noOvertrade', rule: 5, label: (L) => `No overtrading (stopped after ${L.maxLossTrades} losing trades)` },
  { id: 'noGreed', rule: 6, label: () => 'No greed: trailed SL only on a clean chart' },
  { id: 'targetOk', rule: 2, label: (L) => `Followed the profit rule (exit at ₹${L.targetMin}–${L.targetMax})`, profitOnly: true },
];

// Ticks the trade has. Older trades saved before the tick boxes existed fall back to automatic checks.
export function resolveChecks(t, L, prior = 0) {
  const c = t.checks || {};
  const g = t.grossPnl;
  return {
    slPlaced: c.slPlaced ?? num(t.stopLoss) > 0,
    lossOk: c.lossOk ?? (g == null || g >= -L.maxLoss),
    confirm5m: !!c.confirm5m,
    srLevel: !!c.srLevel,
    expiryOk: !!c.expiryOk,
    noOvertrade: c.noOvertrade ?? prior < L.maxLossTrades,
    noGreed: !!c.noGreed,
    targetOk: c.targetOk ?? (g != null && g >= L.targetMin && g <= L.targetMax),
  };
}

export function evaluateTrade(t, L, prior = 0) {
  const c = resolveChecks(t, L, prior);
  const g = t.grossPnl;
  return RULES.filter((r) => (!r.fnoOnly || t.segment === 'fno') && (!r.profitOnly || g == null || g > 0))
    .map((r) => ({ id: r.id, rule: r.rule, label: r.label(L), ok: !!c[r.id] }));
}

// Evaluate all trades in order so rule 5 (earlier losses the same day) is right.
export function evalAll(trades, L) {
  const sorted = [...trades].sort((a, b) => (a.date + (a.createdAt || '')).localeCompare(b.date + (b.createdAt || '')));
  const losses = {};
  const out = {};
  for (const t of sorted) {
    const prior = losses[t.date] || 0;
    const items = evaluateTrade(t, L, prior);
    out[t._id] = { items, score: items.length ? items.filter((i) => i.ok).length / items.length : 1, broken: items.filter((i) => !i.ok) };
    if (t.grossPnl < 0) losses[t.date] = prior + 1;
  }
  return out;
}

export function sinceDate(range, today) {
  const days = { '7d': 7, '30d': 30, '3m': 90 }[range];
  if (!days) return '';
  const d = new Date(today + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
export const inRange = (trades, range, today) => {
  const from = sinceDate(range, today);
  return from ? trades.filter((t) => t.date >= from) : trades;
};

export function computeStats(trades, evals = {}) {
  const sorted = [...trades].sort((a, b) => (a.date + (a.createdAt || '')).localeCompare(b.date + (b.createdAt || '')));
  const n = sorted.length;
  const wins = sorted.filter((t) => t.netPnl > 0);
  const losses = sorted.filter((t) => t.netPnl < 0);
  const gw = sum(wins, 'netPnl'), gl = Math.abs(sum(losses, 'netPnl'));

  const byDay = {};
  for (const t of sorted) byDay[t.date] = (byDay[t.date] || 0) + t.netPnl;
  let cum = 0, peak = 0, maxDD = 0;
  const curve = Object.keys(byDay).sort().map((d) => {
    cum += byDay[d];
    peak = Math.max(peak, cum);
    maxDD = Math.min(maxDD, cum - peak);
    return { date: d, day: r2(byDay[d]), cum: r2(cum), dd: r2(cum - peak) };
  });

  let w = 0, l = 0, bestW = 0, bestL = 0;
  for (const t of sorted) {
    if (t.netPnl > 0) { w++; l = 0; } else if (t.netPnl < 0) { l++; w = 0; } else { w = 0; l = 0; }
    bestW = Math.max(bestW, w); bestL = Math.max(bestL, l);
  }
  const scores = sorted.map((t) => evals[t._id]?.score).filter((x) => x != null);
  const net = sum(sorted, 'netPnl');
  return {
    n, net, gross: sum(sorted, 'grossPnl'), fees: sum(sorted, 'fees'),
    winRate: n ? wins.length / n : 0,
    avgWin: wins.length ? gw / wins.length : 0,
    avgLoss: losses.length ? gl / losses.length : 0,
    profitFactor: gl ? gw / gl : gw ? Infinity : 0,
    expectancy: n ? net / n : 0,
    best: n ? Math.max(...sorted.map((t) => t.netPnl)) : null,
    worst: n ? Math.min(...sorted.map((t) => t.netPnl)) : null,
    maxDrawdown: Math.abs(maxDD),
    bestStreak: bestW, worstStreak: bestL, currentStreak: w > 0 ? w : l > 0 ? -l : 0,
    discipline: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
    byDay, curve,
  };
}

export function groupBy(trades, keyFn) {
  const m = {};
  for (const t of trades) (m[keyFn(t) || 'Not set'] ||= []).push(t);
  return Object.entries(m)
    .map(([key, ts]) => ({ key, n: ts.length, net: sum(ts, 'netPnl'), win: ts.filter((t) => t.netPnl > 0).length / ts.length }))
    .sort((a, b) => b.net - a.net);
}
export const instrumentOf = (t) => (t.segment === 'fno' ? t.underlying || 'F&O' : t.symbol);
