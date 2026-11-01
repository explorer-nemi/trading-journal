import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Route, Routes } from 'react-router-dom';
import { api, setKey } from './api';
import { Ctx } from './store';
import { LIMITS, evalAll, istDate, marketOpen } from './rules';
import { Icon, nice } from './ui';
import Dashboard from './pages/Dashboard';
import Journal from './pages/Journal';
import Trades from './pages/Trades';
import Planner from './pages/Planner';
import Insights from './pages/Insights';
import OiPage from './pages/OiPage';
import Profile from './pages/Profile';

const NAV = [
  ['/', 'Today', 'home'],
  ['/trades', 'Trades', 'list'],
  ['/trade/new', 'Add', 'plus', 'add'],
  ['/planner', 'Planner', 'todo'],
  ['/insights', 'Insights', 'chart'],
  ['/oi', 'Nifty OI', 'pulse'],
  ['/profile', 'Profile', 'user', 'desk'],
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
  const [theme, setTheme] = useState(() => localStorage.getItem('tradelog_theme') || 'dark');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('tradelog_theme', theme);
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', theme === 'dark' ? '#0a0f1c' : '#f3f5fa');
  }, [theme]);

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

  const toast = useCallback((m) => { setMsg(m); setTimeout(() => setMsg(''), 2400); }, []);
  const evals = useMemo(() => evalAll(trades, LIMITS), [trades]);
  const saveDay = async (date, body) => {
    const d = await api.saveDay(date, body);
    setDays((p) => [...p.filter((x) => x.date !== date), d]);
  };
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
        <button className="btn primary" onClick={() => { setStatus('loading'); load(); }}>Try again</button>
      </div></div>
    );

  const today = istDate();
  const open = marketOpen();
  const ctx = {
    trades, profile, setProfile, days, limits: LIMITS, evals, saveDay, reload: load, toast, today,
    install, canInstall: !!installEv, theme,
  };
  return (
    <Ctx.Provider value={ctx}>
      <div className="shell">
        <nav className="nav" aria-label="Main">
          <div className="brand"><span className="logo" />TradeLog</div>
          {NAV.map(([to, label, icon, cls = '']) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `${cls} ${isActive ? 'on' : ''}`}>
              <Icon n={icon} size={20} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="main">
          <header className="topbar">
            <div className="top-l">
              <span className={'pill' + (open ? ' on' : '')}><i />{open ? 'Market open' : 'Market closed'}</span>
              <span className="mute small">{nice(today)}</span>
            </div>
            <div className="top-r">
              {installEv && <button className="btn sm" onClick={install}><Icon n="download" size={15} /> Install</button>}
              <button className="icon-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Switch to day mode' : 'Switch to night mode'} title={theme === 'dark' ? 'Day mode' : 'Night mode'}>
                <Icon n={theme === 'dark' ? 'sun' : 'moon'} size={18} />
              </button>
              <Link to="/profile" className="avatar" aria-label="Profile">{(profile?.displayName || 'T').trim().charAt(0).toUpperCase()}</Link>
            </div>
          </header>
          <main className="page">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/trade/new" element={<Journal key="new" />} />
              <Route path="/trade/:id" element={<Journal key="edit" />} />
              <Route path="/trades" element={<Trades />} />
              <Route path="/planner" element={<Planner />} />
              <Route path="/insights" element={<Insights />} />
              <Route path="/oi" element={<OiPage />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="*" element={<Dashboard />} />
            </Routes>
          </main>
        </div>
        {msg && <div className="toast" role="status">{msg}</div>}
      </div>
    </Ctx.Provider>
  );
}
