import { useMemo, useState } from 'react';
import { useApp } from '../store';
import { computeStats, groupBy } from '../rules';
import { money, pct, tone } from '../ui';

const short = (n) => (Math.abs(n) >= 1000 ? (n / 1000).toFixed(1) + 'k' : Math.round(n));

function Table({ title, rows }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {rows.length === 0 ? <p className="mute">No data yet.</p> : (
        <table className="tbl"><thead><tr><th>Name</th><th>Trades</th><th>Win rate</th><th>Net</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.key}><td>{r.key}</td><td>{r.n}</td><td>{pct(r.win)}</td><td className={'num ' + tone(r.net)}>{money(r.net, true)}</td></tr>)}</tbody></table>
      )}
    </section>
  );
}

export default function Insights() {
  const { trades, evals, days, today, limits } = useApp();
  const [ym, setYm] = useState(today.slice(0, 7));
  const stats = useMemo(() => computeStats(trades, evals), [trades, evals]);
  const noTradeDates = new Set(days.filter((d) => d.noTrade).map((d) => d.date));

  const [y, m] = ym.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const lead = (first.getDay() + 6) % 7; // Monday first
  const count = new Date(y, m, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  const maxAbs = Math.max(1, ...Object.entries(stats.byDay).filter(([d]) => d.startsWith(ym)).map(([, v]) => Math.abs(v)));
  const shift = (d) => { const x = new Date(y, m - 1 + d, 1); setYm(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`); };
  const monthNet = Object.entries(stats.byDay).filter(([d]) => d.startsWith(ym)).reduce((s, [, v]) => s + v, 0);

  const mistakes = {};
  trades.forEach((t) => (t.psychology?.mistakes || []).forEach((x) => (mistakes[x] = (mistakes[x] || 0) + 1)));
  const mk = Object.entries(mistakes).sort((a, b) => b[1] - a[1]);
  const broken = {};
  Object.values(evals).forEach((e) => e.broken.forEach((b) => (broken[b.label] = (broken[b.label] || 0) + 1)));
  const bk = Object.entries(broken).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <header className="head"><div><h1>Insights</h1><p className="mute">Where your money and your discipline go</p></div></header>

      <section className="kpis">
        <div className="stat"><span className="stat-l">Net P&L</span><strong className={'stat-v ' + tone(stats.net)}>{money(stats.net, true)}</strong><span className="stat-s">fees {money(stats.fees)}</span></div>
        <div className="stat"><span className="stat-l">Win rate</span><strong className="stat-v">{pct(stats.n ? stats.winRate : null)}</strong><span className="stat-s">{stats.n} trades</span></div>
        <div className="stat"><span className="stat-l">Avg win / avg loss</span><strong className="stat-v">{money(stats.avgWin)} / {money(stats.avgLoss)}</strong></div>
        <div className="stat"><span className="stat-l">Discipline</span><strong className="stat-v">{pct(stats.discipline)}</strong><span className="stat-s">rules followed</span></div>
      </section>

      <section className="panel">
        <div className="row between">
          <h2>Daily P&L calendar</h2>
          <div className="row gap"><button className="btn" onClick={() => shift(-1)} aria-label="Previous month">‹</button><strong>{first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</strong><button className="btn" onClick={() => shift(1)} aria-label="Next month">›</button></div>
        </div>
        <p className={'mute ' + tone(monthNet)}>Month net {money(monthNet, true)}</p>
        <div className="cal">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <span key={d} className="cal-h">{d}</span>)}
          {cells.map((d, i) => {
            if (!d) return <span key={i} />;
            const key = `${ym}-${String(d).padStart(2, '0')}`;
            const v = stats.byDay[key];
            const a = v == null ? 0 : 0.15 + 0.5 * (Math.abs(v) / maxAbs);
            return (
              <span key={i} className={'cal-d' + (v > 0 ? ' up' : v < 0 ? ' dn' : '') + (noTradeDates.has(key) ? ' rest' : '')} style={{ '--a': a }} title={noTradeDates.has(key) ? 'No-trade day' : v != null ? money(v, true) : ''}>
                <small>{d}</small>{v != null && <b>{v > 0 ? '+' : v < 0 ? '−' : ''}{short(Math.abs(v))}</b>}{noTradeDates.has(key) && v == null && <b>rest</b>}
              </span>
            );
          })}
        </div>
      </section>

      <div className="two-col">
        <Table title="By session" rows={groupBy(trades, (t) => (t.session === 'day' ? 'Day trade' : 'Afternoon trade'))} />
        <Table title="By strategy" rows={groupBy(trades, (t) => t.strategy)} />
        <Table title="By segment" rows={groupBy(trades, (t) => (t.segment === 'fno' ? t.underlying || 'F&O' : 'Equity'))} />
        <Table title="By emotion" rows={groupBy(trades, (t) => t.psychology?.emotion)} />
      </div>

      <div className="two-col">
        <section className="panel"><h2>Mistakes you log most</h2>
          {mk.length === 0 ? <p className="mute">No mistakes logged yet.</p> : mk.map(([k, v]) => <div key={k} className="hbar"><span>{k}</span><i style={{ width: (v / mk[0][1]) * 100 + '%' }} /><b>{v}</b></div>)}</section>
        <section className="panel"><h2>Rules you break most</h2>
          {bk.length === 0 ? <p className="mute">No rule breaks recorded. Keep it up.</p> : bk.map(([k, v]) => <div key={k} className="hbar warn"><span>{k}</span><i style={{ width: (v / bk[0][1]) * 100 + '%' }} /><b>{v}</b></div>)}
          <p className="mute small">Limits in use: stop at {money(-limits.maxLoss)}, exit at {limits.targetMin}–{limits.targetMax}, stop the day after {limits.maxLossTrades} losing trades.</p></section>
      </div>
    </>
  );
}
