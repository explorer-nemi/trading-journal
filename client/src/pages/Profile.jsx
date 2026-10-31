import { useState } from 'react';
import { api, getKey, setKey } from '../api';
import { useApp } from '../store';
import { Icon } from '../ui';

const RULES = [
  'Exit if the loss reaches the stop limit (before tax).',
  'Exit when profit reaches the target range.',
  'Enter only after 5 min confirmation, at a strong support or resistance.',
  'If expiry is near, take the next expiry.',
  'No overtrading: stop the day after the loss limit.',
  'No greed: trail the SL only if the chart looks good.',
  'Never trade without a stop loss.',
];

export default function Profile() {
  const { profile, setProfile, trades, toast, install, canInstall } = useApp();
  const [f, setF] = useState({ ...profile });
  const [key, setK] = useState(getKey());
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const numF = (k, label, hint) => (
    <label className="field"><span>{label}</span><input type="number" step="any" value={f[k] ?? ''} onChange={(e) => set(k, e.target.value === '' ? '' : Number(e.target.value))} />{hint && <small className="mute">{hint}</small>}</label>
  );

  async function save() {
    try {
      const body = Object.fromEntries(['displayName', 'broker', 'startingCapital', 'maxLoss', 'targetMin', 'targetMax', 'maxLossTrades', 'expiryNearDays'].map((k) => [k, f[k]]));
      setProfile(await api.saveProfile(body)); toast('Profile saved');
    } catch (e) { toast(e.message); }
  }

  function exportCsv() {
    const cols = ['date', 'session', 'segment', 'symbol', 'direction', 'qty', 'entryPrice', 'exitPrice', 'stopLoss', 'target', 'fees', 'grossPnl', 'netPnl', 'strategy', 'outcome'];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [cols.join(','), ...trades.map((t) => cols.map((c) => esc(t[c])).join(','))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'tradelog-trades.csv';
    a.click();
  }

  return (
    <>
      <header className="head"><div><h1>Profile</h1><p className="mute">Your details and your trading rules</p></div></header>
      <div className="two-col">
        <section className="panel form">
          <h2>About you</h2>
          <label className="field"><span>Name</span><input value={f.displayName || ''} onChange={(e) => set('displayName', e.target.value)} /></label>
          <label className="field"><span>Broker</span><input value={f.broker || ''} onChange={(e) => set('broker', e.target.value)} placeholder="Groww, Zerodha, Upstox…" /></label>
          {numF('startingCapital', 'Starting capital (₹)')}
          <h2>Rule limits</h2>
          <div className="grid">
            {numF('maxLoss', 'Max loss per trade (₹)', 'Rule 1, before tax')}
            {numF('targetMin', 'Target from (₹)', 'Rule 2')}
            {numF('targetMax', 'Target up to (₹)', 'Rule 2')}
            {numF('maxLossTrades', 'Losing trades that stop the day', 'Rule 5')}
            {numF('expiryNearDays', 'Expiry counts as near within (days)', 'Rule 4')}
          </div>
          <div className="row end"><button className="btn primary" onClick={save}>Save profile</button></div>
        </section>
        <div>
          <section className="panel"><h2>Your rules</h2>
            <ol className="rule-list">{RULES.map((r) => <li key={r}>{r}</li>)}</ol></section>
          <section className="panel"><h2>App and data</h2>
            <div className="row gap wrap">
              {canInstall && <button className="btn primary" onClick={install}><Icon n="download" size={16} /> Install app</button>}
              <button className="btn" onClick={exportCsv}><Icon n="download" size={16} /> Export trades (CSV)</button>
            </div>
            {!canInstall && <p className="mute small">To install: open the site in Chrome, then menu → Install app (Android) or Share → Add to Home Screen (iPhone).</p>}
            <label className="field"><span>Access key on this device</span>
              <input type="password" value={key} onChange={(e) => setK(e.target.value)} onBlur={() => setKey(key)} placeholder="Only needed if APP_KEY is set on the server" /></label>
          </section>
        </div>
      </div>
    </>
  );
}
