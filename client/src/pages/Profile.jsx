import { useState } from 'react';
import { api, getKey, setKey } from '../api';
import { useApp } from '../store';
import { exportCsv } from '../csv';
import { Icon } from '../ui';

export default function Profile() {
  const { profile, setProfile, trades, toast, install, canInstall } = useApp();
  const [f, setF] = useState({ displayName: profile?.displayName || '', broker: profile?.broker || '', startingCapital: profile?.startingCapital ?? '' });
  const [key, setK] = useState(getKey());
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    try {
      setProfile(await api.saveProfile({ displayName: f.displayName, broker: f.broker, startingCapital: Number(f.startingCapital) || 0 }));
      toast('Profile saved');
    } catch (e) { toast(e.message); }
  }

  return (
    <>
      <header className="head"><div><h1>Profile</h1><p className="mute">Your details and app settings</p></div></header>
      <div className="two-col">
        <section className="panel form">
          <h2>About you</h2>
          <label className="field"><span>Name</span><input value={f.displayName} onChange={(e) => set('displayName', e.target.value)} /></label>
          <label className="field"><span>Broker</span><input value={f.broker} onChange={(e) => set('broker', e.target.value)} placeholder="Groww, Zerodha, Upstox…" /></label>
          <label className="field"><span>Starting capital (₹)</span><input type="number" step="any" value={f.startingCapital} onChange={(e) => set('startingCapital', e.target.value)} /><small className="mute">Used for the Balance card on the dashboard.</small></label>
          <div className="row end"><button className="btn primary" onClick={save}>Save profile</button></div>
        </section>
        <section className="panel">
          <h2>App and data</h2>
          <div className="row gap wrap">
            {canInstall && <button className="btn primary" onClick={install}><Icon n="download" size={16} /> Install app</button>}
            <button className="btn" onClick={() => exportCsv(trades)}><Icon n="download" size={16} /> Export trades (CSV)</button>
          </div>
          {!canInstall && <p className="mute small">To install: open the site in Chrome, then menu → Install app (Android) or Share → Add to Home Screen (iPhone).</p>}
          <label className="field gap-t"><span>Access key on this device</span>
            <input type="password" value={key} onChange={(e) => setK(e.target.value)} onBlur={() => setKey(key)} placeholder="Only needed if APP_KEY is set on the server" /></label>
        </section>
      </div>
    </>
  );
}
