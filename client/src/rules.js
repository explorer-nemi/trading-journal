// Your seven rules, turned into code. Limits come from the Profile page.
export const DEFAULT_LIMITS = { maxLoss: 120, targetMin: 350, targetMax: 400, maxLossTrades: 2, expiryNearDays: 1 };

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

// Which of your rules did this trade follow? priorLosses = losing trades already taken that day.
export function evaluateTrade(t, L, priorLosses = 0) {
  const g = t.grossPnl;
  const c = t.checks || {};
  const list = [
    { id: 'sl', rule: 7, label: 'Stop loss placed', ok: num(t.stopLoss) > 0, auto: true },
    { id: 'loss', rule: 1, label: `Loss kept within ₹${L.maxLoss}`, ok: g == null || g >= -L.maxLoss, auto: true },
    { id: 'overtrade', rule: 5, label: 'Not traded after the daily loss limit', ok: priorLosses < L.maxLossTrades, auto: true },
    { id: 'confirm5m', rule: 3, label: 'Entered after 5 min confirmation', ok: !!c.confirm5m },
    { id: 'srLevel', rule: 3, label: 'Entry at strong support or resistance', ok: !!c.srLevel },
  ];
  if (t.segment === 'fno') list.push({ id: 'expiryOk', rule: 4, label: 'Expiry not too close (or took next expiry)', ok: !!c.expiryOk });
  list.push({ id: 'noGreed', rule: 6, label: 'No greed: exited on plan, trailed SL only on a clean chart', ok: !!c.noGreed });
  return list;
}

// Evaluate every trade in order so rule 5 (loss count earlier the same day) is right.
export function evalAll(trades, L) {
  const sorted = [...trades].sort((a, b) => (a.date + (a.createdAt || '')).localeCompare(b.date + (b.createdAt || '')));
  const losses = {};
  const out = {};
  for (const t of sorted) {
    const prior = losses[t.date] || 0;
    const items = evaluateTrade(t, L, prior);
    out[t._id] = { items, score: items.filter((i) => i.ok).length / items.length, broken: items.filter((i) => !i.ok) };
    if (t.grossPnl < 0) losses[t.date] = prior + 1;
  }
  return out;
}

export const sum = (arr, k) => arr.reduce((s, x) => s + (Number(x[k]) || 0), 0);

export function computeStats(trades, evals) {
  const n = trades.length;
  const wins = trades.filter((t) => t.netPnl > 0);
  const losses = trades.filter((t) => t.netPnl < 0);
  const gw = sum(wins, 'netPnl'), gl = Math.abs(sum(losses, 'netPnl'));
  const byDay = {};
  for (const t of trades) byDay[t.date] = (byDay[t.date] || 0) + t.netPnl;
  const dates = Object.keys(byDay).sort();
  let cum = 0;
  const curve = dates.map((d) => ({ date: d, day: byDay[d], cum: (cum += byDay[d]) }));
  const scores = trades.map((t) => evals[t._id]?.score).filter((x) => x != null);
  return {
    n, net: sum(trades, 'netPnl'), gross: sum(trades, 'grossPnl'), fees: sum(trades, 'fees'),
    winRate: n ? wins.length / n : 0,
    avgWin: wins.length ? gw / wins.length : 0,
    avgLoss: losses.length ? gl / losses.length : 0,
    profitFactor: gl ? gw / gl : gw ? Infinity : 0,
    discipline: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
    byDay, curve,
  };
}

export function groupBy(trades, keyFn) {
  const m = {};
  for (const t of trades) {
    const k = keyFn(t) || 'Not set';
    (m[k] ||= []).push(t);
  }
  return Object.entries(m)
    .map(([k, ts]) => ({ key: k, n: ts.length, net: sum(ts, 'netPnl'), win: ts.filter((t) => t.netPnl > 0).length / ts.length }))
    .sort((a, b) => b.net - a.net);
}
