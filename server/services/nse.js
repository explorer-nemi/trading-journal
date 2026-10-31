// Live Nifty option-chain (OI) from NSE's public website endpoint.
// NSE has no official free API: this uses the same JSON the nseindia.com option-chain page loads.
// It needs a browser-like cookie first, and NSE may block server IPs outside India or change the
// endpoint without notice. Everything NSE-specific is in this one file so it is easy to swap.

const BASE = 'https://www.nseindia.com';
const HEAD = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  accept: 'application/json,text/plain,*/*',
  'accept-language': 'en-US,en;q=0.9',
  referer: `${BASE}/option-chain`,
};

let cookie = '';
let cookieAt = 0;
let cache = { raw: null, at: 0 };
const CACHE_MS = 30_000;

async function refreshCookie() {
  const r = await fetch(`${BASE}/option-chain`, {
    headers: { ...HEAD, accept: 'text/html,application/xhtml+xml' },
    signal: AbortSignal.timeout(10_000),
  });
  const set = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : [];
  cookie = set.map((c) => c.split(';')[0]).join('; ');
  cookieAt = Date.now();
}

async function nseGet(path, retry = true) {
  if (!cookie || Date.now() - cookieAt > 4 * 60_000) await refreshCookie();
  const r = await fetch(BASE + path, { headers: { ...HEAD, cookie }, signal: AbortSignal.timeout(10_000) });
  if ((r.status === 401 || r.status === 403) && retry) {
    await refreshCookie();
    return nseGet(path, false);
  }
  if (!r.ok) throw new Error(`NSE responded ${r.status}`);
  return r.json();
}

const istMidnight = (now = new Date()) =>
  Date.parse(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now) + 'T00:00:00+05:30');
const expiryMs = (s) => Date.parse(`${s.slice(0, 2)} ${s.slice(3, 6)} ${s.slice(7)} 00:00:00 GMT+0530`);

// Pure function: raw NSE payload -> the compact shape the UI uses. Easy to unit test.
export function summarise(raw, { expiry, win = 12, nearDays = 1, now = new Date() } = {}) {
  const rec = raw?.records;
  if (!rec?.data?.length) throw new Error('Unexpected NSE response');
  const spot = rec.underlyingValue;
  const today = istMidnight(now);
  const expiries = (rec.expiryDates || []).map((date) => ({ date, dte: Math.round((expiryMs(date) - today) / 864e5) }));

  // Rule 4: if the nearest expiry is too close, suggest the next one.
  const suggested = (expiries.find((e) => e.dte > nearDays) || expiries[0])?.date;
  const selected = expiries.some((e) => e.date === expiry) ? expiry : suggested;

  const byStrike = new Map();
  for (const row of rec.data) {
    if (row.expiryDate !== selected) continue;
    const ce = row.CE || {}, pe = row.PE || {};
    byStrike.set(row.strikePrice, {
      strike: row.strikePrice,
      ceOI: ce.openInterest || 0, ceChg: ce.changeinOpenInterest || 0, ceLtp: ce.lastPrice ?? null, ceIv: ce.impliedVolatility ?? null,
      peOI: pe.openInterest || 0, peChg: pe.changeinOpenInterest || 0, peLtp: pe.lastPrice ?? null, peIv: pe.impliedVolatility ?? null,
    });
  }
  const all = [...byStrike.values()].sort((a, b) => a.strike - b.strike);
  if (!all.length) throw new Error('No strikes for that expiry');

  const totalCE = all.reduce((s, r) => s + r.ceOI, 0);
  const totalPE = all.reduce((s, r) => s + r.peOI, 0);
  const atm = all.reduce((best, r) => (Math.abs(r.strike - spot) < Math.abs(best.strike - spot) ? r : best)).strike;
  const near = all.filter((r) => Math.abs(r.strike - spot) <= 1000);
  const pool = near.length ? near : all;
  const resistance = pool.reduce((b, r) => (r.ceOI > b.ceOI ? r : b)).strike; // biggest call writing
  const support = pool.reduce((b, r) => (r.peOI > b.peOI ? r : b)).strike; // biggest put writing
  const i = all.findIndex((r) => r.strike === atm);

  return {
    symbol: 'NIFTY',
    spot,
    asOf: rec.timestamp,
    expiries,
    selectedExpiry: selected,
    suggestedExpiry: suggested,
    nearestExpiry: expiries[0]?.date,
    expiryNear: expiries[0] ? expiries[0].dte <= nearDays : false,
    totalCE, totalPE,
    pcr: totalCE ? +(totalPE / totalCE).toFixed(2) : null,
    atm, support, resistance,
    rows: all.slice(Math.max(0, i - win), i + win + 1),
  };
}

export async function getNiftyOI(opts = {}) {
  let stale = false, error;
  if (!cache.raw || Date.now() - cache.at > CACHE_MS) {
    try {
      cache = { raw: await nseGet('/api/option-chain-indices?symbol=NIFTY'), at: Date.now() };
    } catch (e) {
      if (!cache.raw) throw e;
      stale = true;
      error = e.message;
    }
  }
  return { ...summarise(cache.raw, opts), fetchedAt: new Date(cache.at).toISOString(), stale, error };
}
