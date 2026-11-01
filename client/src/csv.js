const COLS = ['date', 'session', 'segment', 'underlying', 'optionType', 'strike', 'expiry', 'symbol', 'direction', 'qty', 'entryPrice', 'exitPrice', 'stopLoss', 'target', 'fees', 'grossPnl', 'netPnl', 'strategy', 'outcome', 'analysis'];

export function exportCsv(trades) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [COLS.join(','), ...trades.map((t) => COLS.map((c) => esc(t[c])).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'tradelog-trades.csv';
  a.click();
}

// Small CSV reader that understands quoted cells
export function parseCsv(text) {
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some((c) => c !== '')) rows.push(row);
  const head = (rows.shift() || []).map((h) => h.trim().replace(/^\uFEFF/, ''));
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}

const num = (v) => { if (v === '' || v == null) return null; const x = Number(v); return Number.isFinite(x) ? x : null; };

// One CSV row -> trade body, or null when a required field is missing
export function rowToTrade(r) {
  const date = (r.date || '').slice(0, 10);
  const symbol = (r.symbol || '').trim();
  const qty = num(r.qty), entryPrice = num(r.entryPrice), exitPrice = num(r.exitPrice);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !symbol || !(qty > 0) || entryPrice == null || exitPrice == null) return null;
  const fno = r.segment === 'fno' || (r.segment !== 'equity' && /^(NIFTY|SENSEX)/i.test(symbol));
  const ot = (r.optionType || '').toUpperCase();
  return {
    date, symbol, qty, entryPrice, exitPrice,
    session: r.session === 'afternoon' ? 'afternoon' : 'day',
    segment: fno ? 'fno' : 'equity',
    underlying: fno ? (/SENSEX/i.test(r.underlying || symbol) ? 'SENSEX' : 'NIFTY') : '',
    optionType: fno && ['CE', 'PE', 'FUT'].includes(ot) ? ot : '',
    strike: num(r.strike), expiry: r.expiry || '',
    direction: r.direction === 'short' ? 'short' : 'long',
    stopLoss: num(r.stopLoss), target: num(r.target), fees: num(r.fees) || 0,
    strategy: r.strategy || '', outcome: r.outcome || '', analysis: r.analysis || '',
  };
}
