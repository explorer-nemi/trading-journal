import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '../store';
import { Bars, ExitTrack, Icon, Range, Stat, chartColors, money, nice, pct, tone } from '../ui';
import { computeStats, groupBy, inRange, instrumentOf, sum } from '../rules';
import { OiStrip } from './OiPage';

export default function Dashboard() {
  const { trades, evals, limits, days, saveDay, today, profile, theme } = useApp();
  const [range, setRange] = useState('30d');
  const C = chartColors(theme);

  const todays = trades.filter((t) => t.date === today).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  const lossCount = todays.filter((t) => t.grossPnl < 0).length;
  const plan = days.find((d) => d.date === today);
  const noTrade = !!plan?.noTrade;
  const todos = plan?.todos || [];
  const locked = lossCount >= limits.maxLossTrades;

  let state = { cls: 'go', title: 'Trading allowed', body: `${lossCount} of ${limits.maxLossTrades} losing trades used. Wait for 5 min confirmation at a strong level.` };
  if (noTrade) state = { cls: 'rest', title: 'No-trade day', body: 'You marked today as a rest day. Close the charts.' };
  else if (locked) state = { cls: 'stop', title: 'Stop trading for today', body: `${lossCount} losing trades. Rule 5: no more entries today.` };
  else if (!todays.length) state = { cls: 'go', title: 'No trades yet', body: 'Wait for 5 min confirmation at a strong support or resistance. Always place the SL.' };

  const ranged = useMemo(() => inRange(trades, range, today), [trades, range, today]);
  const s = useMemo(() => computeStats(ranged, evals), [ranged, evals]);
  const all = useMemo(() => computeStats(trades, evals), [trades, evals]);
  const byInstrument = useMemo(() => groupBy(ranged, instrumentOf), [ranged]);
  const todayNet = sum(todays, 'netPnl');
  const capital = Number(profile?.startingCapital) || 0;

  const toggleTodo = (i) => saveDay(today, { todos: todos.map((t, j) => (j === i ? { ...t, done: !t.done } : t)) });

  return (
    <>
      <header className="head">
        <div>
          <h1>Hi {profile?.displayName || 'Trader'}</h1>
          <p className="mute">Your trading day at a glance</p>
        </div>
        <label className="switch">
          <input type="checkbox" checked={noTrade} onChange={(e) => saveDay(today, { noTrade: e.target.checked })} />
          <span className="knob" /> No trade day
        </label>
      </header>

      <section className={'panel guard ' + state.cls}>
        <div className="guard-top">
          <div>
            <h2>{state.title}</h2>
            <p>{state.body}</p>
          </div>
          <Link to="/trade/new" className="btn primary"><Icon n="plus" size={16} /> Log a trade</Link>
        </div>
        <ExitTrack values={todays.map((t) => t.grossPnl)} limits={limits} />
        <div className="guard-foot">
          <Stat label="Trades today" value={todays.length} />
          <Stat label="Gross P&L (before tax)" value={money(sum(todays, 'grossPnl'), true)} cls={tone(sum(todays, 'grossPnl'))} />
          <Stat label="Net after fees" value={money(todayNet, true)} cls={tone(todayNet)} />
        </div>
      </section>

      <OiStrip />

      <div className="row between wrap gap">
        <h2 className="sect">Performance</h2>
        <Range value={range} onChange={setRange} />
      </div>
      <section className="kpis">
        <Stat label={capital ? 'Balance' : 'Net P&L (all time)'} value={money(capital ? capital + all.net : all.net, !capital)} cls={capital ? '' : tone(all.net)} sub="after fees" />
        <Stat label="Today's P&L" value={money(todayNet, true)} cls={tone(todayNet)} sub="after fees" />
        <Stat label="Win rate" value={pct(s.n ? s.winRate : null)} sub={`${s.n} trades`} />
        <Stat label="Profit factor" value={s.profitFactor === Infinity ? '∞' : s.n ? s.profitFactor.toFixed(2) : '–'} sub="wins ÷ losses" />
        <Stat label="Best trade" value={money(s.best, true)} cls="gain" sub="record" />
        <Stat label="Worst trade" value={money(s.worst, true)} cls="loss" sub={`Max drawdown ${money(s.maxDrawdown)}`} />
      </section>

      <section className="panel">
        <div className="row between"><h2>Cumulative equity</h2><span className={'num ' + tone(s.net)}>{money(s.net, true)}</span></div>
        {s.curve.length > 1 ? (
          <div className="chart">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={s.curve} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.line} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={C.line} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="date" tick={{ fill: C.tick, fontSize: 11 }} tickFormatter={(d) => d.slice(5)} stroke={C.grid} />
                <YAxis tick={{ fill: C.tick, fontSize: 11 }} stroke={C.grid} width={56} />
                <Tooltip contentStyle={{ background: C.tip, border: `1px solid ${C.grid}`, borderRadius: 8 }} formatter={(v) => money(v, true)} />
                <Area type="monotone" dataKey="dd" name="Drawdown" stroke={C.dd} strokeWidth={1} strokeDasharray="4 3" fill={C.dd} fillOpacity={0.08} />
                <Area type="monotone" dataKey="cum" name="Net P&L" stroke={C.line} strokeWidth={2} fill="url(#eq)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="mute">The curve appears after trades on two different days in this range.</p>}
      </section>

      <div className="two-col">
        <section className="panel">
          <div className="row between"><h2>Today's plan</h2><Link to="/planner" className="link">Open planner</Link></div>
          {todos.length === 0 ? <p className="mute">No tasks yet. Add your pre-market checklist in the Planner.</p> : (
            <ul className="todo-mini">
              {todos.map((t, i) => (
                <li key={t._id || i}>
                  <label className="tick"><input type="checkbox" checked={t.done} onChange={() => toggleTodo(i)} /><span className="box"><Icon n="check" size={13} /></span><span className={t.done ? 'done' : ''}>{t.text}</span></label>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="panel">
          <h2>Performance by instrument</h2>
          <Bars rows={byInstrument.slice(0, 6)} />
        </section>
      </div>

      <section className="panel">
        <div className="row between"><h2>Latest trades</h2><Link to="/trades" className="link">See all</Link></div>
        {trades.length === 0 && <p className="mute">No trades yet. <Link to="/trade/new" className="link">Log your first trade</Link>.</p>}
        {trades.slice(0, 5).map((t) => (
          <Link to={`/trade/${t._id}`} key={t._id} className="mini">
            <span><strong>{t.symbol}</strong><small>{nice(t.date)} · {t.session === 'day' ? 'Day' : 'Afternoon'}</small></span>
            <span className={'num ' + tone(t.grossPnl)}>{money(t.grossPnl, true)}</span>
          </Link>
        ))}
      </section>
    </>
  );
}
