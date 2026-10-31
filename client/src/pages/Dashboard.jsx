import { Link } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '../store';
import { ExitTrack, Icon, Stat, money, nice, pct, tone } from '../ui';
import { computeStats, marketOpen, sum } from '../rules';
import { OiStrip } from './OiPage';

export default function Dashboard() {
  const { trades, evals, limits, days, saveDay, today, profile } = useApp();
  const todays = trades.filter((t) => t.date === today).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const lossCount = todays.filter((t) => t.grossPnl < 0).length;
  const noTrade = !!days.find((d) => d.date === today)?.noTrade;
  const locked = lossCount >= limits.maxLossTrades;

  let state = { cls: 'go', title: 'Trading allowed', body: `${lossCount} of ${limits.maxLossTrades} losing trades used. Wait for 5 min confirmation at a strong level.` };
  if (noTrade) state = { cls: 'rest', title: 'No-trade day', body: 'You marked today as a rest day. Close the charts.' };
  else if (locked) state = { cls: 'stop', title: 'Stop trading for today', body: `${lossCount} losing trades. Rule 5: no more entries today.` };
  else if (!todays.length) state = { cls: 'go', title: 'No trades yet', body: 'Wait for 5 min confirmation at a strong support or resistance. Always place the SL.' };

  const month = today.slice(0, 7);
  const inMonth = trades.filter((t) => t.date.startsWith(month));
  const m = computeStats(inMonth, evals);
  const all = computeStats(trades, evals);
  const open = marketOpen();

  return (
    <>
      <header className="head">
        <div>
          <h1>Hi {profile?.displayName || 'Trader'}</h1>
          <p className="mute">{nice(today)} · <span className={open ? 'gain' : ''}>{open ? 'Market open' : 'Market closed'}</span></p>
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
          <Stat label="Net after fees" value={money(sum(todays, 'netPnl'), true)} cls={tone(sum(todays, 'netPnl'))} />
        </div>
      </section>

      <OiStrip />

      <section className="kpis">
        <Stat label="This month, net" value={money(m.net, true)} cls={tone(m.net)} sub={`${m.n} trades`} />
        <Stat label="Win rate" value={pct(m.n ? m.winRate : null)} sub={`Avg win ${money(m.avgWin)} · loss ${money(m.avgLoss)}`} />
        <Stat label="Profit factor" value={m.profitFactor === Infinity ? '∞' : m.n ? m.profitFactor.toFixed(2) : '–'} sub="wins ÷ losses" />
        <Stat label="Rule discipline" value={pct(m.discipline)} sub="trades that followed your rules" />
      </section>

      <section className="panel">
        <div className="row between"><h2>Equity curve</h2><span className={'mute ' + tone(all.net)}>All time {money(all.net, true)}</span></div>
        {all.curve.length > 1 ? (
          <div className="chart">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={all.curve} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38d4ff" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#38d4ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#213459" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#8ea0c4', fontSize: 11 }} tickFormatter={(d) => d.slice(5)} stroke="#213459" />
                <YAxis tick={{ fill: '#8ea0c4', fontSize: 11 }} stroke="#213459" width={52} />
                <Tooltip contentStyle={{ background: '#0e1a30', border: '1px solid #213459', borderRadius: 8 }} formatter={(v) => money(v, true)} />
                <Area type="monotone" dataKey="cum" name="Net P&L" stroke="#38d4ff" strokeWidth={2} fill="url(#g)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="mute">The curve appears after trades on two different days.</p>}
      </section>

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
