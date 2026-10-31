import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { api, setKey } from './api';
import { Ctx } from './store';
import { DEFAULT_LIMITS, evalAll, istDate } from './rules';
import { Icon } from './ui';
import Dashboard from './pages/Dashboard';
import Journal from './pages/Journal';
import Trades from './pages/Trades';
import Insights from './pages/Insights';
import OiPage from './pages/OiPage';
import Profile from './pages/Profile';

const NAV = [
  ['/', 'Today', 'home'],
  ['/trade/new', 'Add', 'plus'],
  ['/trades', 'Trades', 'list'],
  ['/insights', 'Insights', 'chart'],
  ['/oi', 'Nifty OI', 'pulse'],
  ['/profile', 'Profile', 'user'],
];

export default function App() {
  const [trades, setTrades] = useState([]);
  const [profile, setProfile] = useState(null);
  const [days, setDays] = useState([]);
  const [status, setStatus] = useState('loading');
  const [err, setErr] = useState('');
  const [keyIn, setKeyIn] = useState('');
  const [msg, setMsg] = useState('');
  const [installEv, setInstallEv] = useState(null);

  const load = useCallback(async () => {
    try {
      const [t, p, d] = await Promise.all([api.trades(), api.profile(), api.days()]);
      setTrades(t); setProfile(p); setDays(d); setStatus('ready');
    } catch (e) {
      if (e.code === 401) setStatus('locked');
      else { setErr(e.message); setStatus('error'); }
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const h = (e) => { e.preventDefault(); setInstallEv(e); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  const toast = useCallback((m) => { setMsg(m); setTimeout(() => setMsg(''), 2200); }, []);
  const limits = useMemo(() => ({ ...DEFAULT_LIMITS, ...Object.fromEntries(Object.entries(profile || {}).filter(([k]) => k in DEFAULT_LIMITS)) }), [profile]);
  const evals = useMemo(() => evalAll(trades, limits), [trades, limits]);

  const saveDay = async (date, body) => { const d = await api.saveDay(date, body); setDays((p) => [...p.filter((x) => x.date !== date), d]); };
  const install = async () => { if (!installEv) return; installEv.prompt(); await installEv.userChoice; setInstallEv(null); };

  if (status === 'loading') return <div className="center">Loading your journal…</div>;
  if (status === 'locked')
    return (
      <div className="center"><div className="gate">
        <Icon n="lock" size={22} />
        <h1>Enter your access key</h1>
        <p>This journal is private. The key is the APP_KEY you set on the server. You only enter it once per device.</p>
        <input type="password" value={keyIn} onChange={(e) => setKeyIn(e.target.value)} placeholder="Access key" autoFocus />
        <button className="btn primary" onClick={() => { setKey(keyIn); setStatus('loading'); load(); }}>Unlock</button>
      </div></div>
    );
  if (status === 'error')
    return (
      <div className="center"><div className="gate">
        <h1>Can't reach the database</h1>
        <p>{err}</p>
        <p className="mute">Check MONGODB_URI in server/.env and that your current IP is allowed in Atlas → Network Access.</p>
        <button className="btn primary" onClick={() => { setStatus('loading'); load(); }}>Try again</button>
      </div></div>
    );

  const ctx = { trades, profile, setProfile, days, limits, evals, saveDay, reload: load, toast, today: istDate(), install, canInstall: !!installEv };
  return (
    <Ctx.Provider value={ctx}>
      <div className="shell">
        <nav className="nav" aria-label="Main">
          <div className="brand"><span className="logo" />TradeLog</div>
          {NAV.map(([to, label, icon]) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'on' : '') + (label === 'Add' ? ' add' : '')}>
              <Icon n={icon} size={20} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <main className="page">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/trade/new" element={<Journal key="new" />} />
            <Route path="/trade/:id" element={<Journal key="edit" />} />
            <Route path="/trades" element={<Trades />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/oi" element={<OiPage />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </main>
        {msg && <div className="toast" role="status">{msg}</div>}
      </div>
    </Ctx.Provider>
  );
}
