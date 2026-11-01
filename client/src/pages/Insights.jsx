import { useMemo, useState } from 'react';
import { useApp } from '../store';
import { Bars, Range, Stat, money, pct, tone } from '../ui';
import { computeStats, groupBy, inRange, instrumentOf } from '../rules';

const short = (n) => (Math.abs(n) >= 1000 ? (n / 1000).toFixed(1) + 'k' : Math.round(n));
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
  const [range, setRange] = useState('all');
  const [ym, setYm] = useState(today.slice(0, 7));

  const ranged = useMemo(() => inRange(trades, range, today), [trades, range, today]);
  const s = useMemo(() => computeStats(ranged, evals), [ranged, evals]);
  const all = useMemo(() => computeStats(trades, evals), [trades]);
  const noTradeDates = new Set(days.filter((d) => d.noTrade).map((d) => d.date));

  // calendar (always uses every trade so past months stay visible)
  const [y, m] = ym.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const lead = (first.getDay() + 6) % 7;
  const count = new Date(y, m, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  const monthRows = Object.entries(all.byDay).filter(([d]) => d.startsWith(ym));
  const maxAbs = Math.max(1, ...monthRows.map(([, v]) => Math.abs(v)));
  const monthNet = monthRows.reduce((a, [, v]) => a + v, 0);
  const shift = (d) => { const x = new Date(y, m - 1 + d, 1); setYm(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`); };

  const mistakes = {};
  ranged.forEach((t) => (t.psychology?.mistakes || []).forEach((x) => (mistakes[x] = (mistakes[x] || 0) + 1)));
  const mk = Object.entries(mistakes).sort((a, b) => b[1] - a[1]);

  // how often each rule was followed
  const adherence = {};
  ranged.forEach((t) => (evals[t._id]?.items || []).forEach((i) => {
    const a = (adherence[i.label] ||= { ok: 0, n: 0, rule: i.rule });
    a.n++; if (i.ok) a.ok++;
  }));
  const ad = Object.entries(adherence).map(([label, a]) => ({ label, rule: a.rule, p: a.ok / a.n })).sort((a, b) => a.p - b.p);

  return (
    <>
      <header className="head">
        <div><h1>Insights</h1><p className="mute">Where your money and your discipline go</p></div>
        <Range value={range} onChange={setRange} />
      </header>

      <section className="kpis">
        <Stat label="Net P&L" value={money(s.net, true)} cls={tone(s.net)} sub={`fees ${money(s.fees)}`} />
        <Stat label="Win rate" value={pct(s.n ? s.winRate : null)} sub={`${s.n} trades`} />
        <Stat label="Profit factor" value={s.profitFactor === Infinity ? '∞' : s.n ? s.profitFactor.toFixed(2) : '–'} sub="wins ÷ losses" />
        <Stat label="Expectancy" value={money(s.expectancy, true)} cls={tone(s.expectancy)} sub="average per trade" />
        <Stat label="Avg win / loss" value={`${money(s.avgWin)} / ${money(s.avgLoss)}`} />
        <Stat label="Max drawdown" value={money(s.maxDrawdown)} cls={s.maxDrawdown ? 'loss' : ''} sub="peak to trough" />
        <Stat label="Best / worst" value={`${money(s.best, true)} / ${money(s.worst, true)}`} />
        <Stat label="Streaks" value={`${s.bestStreak}W · ${s.worstStreak}L`} sub={s.currentStreak > 0 ? `now ${s.currentStreak} wins` : s.currentStreak < 0 ? `now ${-s.currentStreak} losses` : 'longest runs'} />
        <Stat label="Discipline" value={pct(s.discipline)} sub="rules followed" />
      </section>

      <section className="panel">
        <div className="row between wrap gap">
          <h2>Daily P&L calendar</h2>
          <div className="datenav">
            <button className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month">‹</button>
            <strong>{first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</strong>
            <button className="icon-btn" onClick={() => shift(1)} aria-label="Next month">›</button>
          </div>
        </div>
        <p className={'small ' + (monthNet ? tone(monthNet) : 'mute')}>Month net {money(monthNet, true)}</p>
        <div className="cal">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <span key={d} className="cal-h">{d}</span>)}
          {cells.map((d, i) => {
            if (!d) return <span key={i} />;
            const key = `${ym}-${String(d).padStart(2, '0')}`;
            const v = all.byDay[key];
            const a = v == null ? 0 : 0.18 + 0.5 * (Math.abs(v) / maxAbs);
            const rest = noTradeDates.has(key);
            return (
              <span key={i} className={'cal-d' + (v > 0 ? ' up' : v < 0 ? ' dn' : '') + (rest ? ' rest' : '')} style={{ '--a': a }} title={rest ? 'No-trade day' : v != null ? money(v, true) : ''}>
                <small>{d}</small>{v != null && <b>{v > 0 ? '+' : v < 0 ? '−' : ''}{short(Math.abs(v))}</b>}{rest && v == null && <b>rest</b>}
              </span>
            );
          })}
        </div>
      </section>

      <div className="two-col">
        <section className="panel"><h2>Performance by instrument</h2><Bars rows={groupBy(ranged, instrumentOf)} /></section>
        <section className="panel">
          <h2>Rule adherence</h2>
          {ad.length === 0 ? <p className="mute">No trades in this range.</p> : ad.map((r) => (
            <div key={r.label} className={'hbar' + (r.p < 0.7 ? ' warn' : '')}><span>{r.label}</span><i style={{ width: r.p * 100 + '%' }} /><b>{pct(r.p)}</b></div>
          ))}
          <p className="mute small">Limits: stop at {money(-limits.maxLoss)}, exit at {limits.targetMin}–{limits.targetMax}, stop the day after {limits.maxLossTrades} losing trades.</p>
        </section>
      </div>

      <div className="two-col">
        <Table title="By session" rows={groupBy(ranged, (t) => (t.session === 'day' ? 'Day trade' : 'Afternoon trade'))} />
        <Table title="By strategy" rows={groupBy(ranged, (t) => t.strategy)} />
        <Table title="By weekday" rows={groupBy(ranged, (t) => DAYS[new Date(t.date + 'T00:00:00').getDay()])} />
        <Table title="By emotion" rows={groupBy(ranged, (t) => t.psychology?.emotion)} />
      </div>

      <section className="panel"><h2>Mistakes you log most</h2>
        {mk.length === 0 ? <p className="mute">No mistakes logged in this range.</p> : mk.map(([k, v]) => <div key={k} className="hbar"><span>{k}</span><i style={{ width: (v / mk[0][1]) * 100 + '%' }} /><b>{v}</b></div>)}
      </section>
    </>
  );
}