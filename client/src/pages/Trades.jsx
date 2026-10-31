import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useApp } from '../store';
import { Icon, money, nice, pct, tone } from '../ui';

export default function Trades() {
  const { trades, evals, reload, toast } = useApp();
  const [seg, setSeg] = useState('all');
  const [ses, setSes] = useState('all');
  const [month, setMonth] = useState('all');
  const [open, setOpen] = useState(null);

  const months = [...new Set(trades.map((t) => t.date.slice(0, 7)))];
  const rows = trades.filter((t) => (seg === 'all' || t.segment === seg) && (ses === 'all' || t.session === ses) && (month === 'all' || t.date.startsWith(month)));

  async function del(t) {
    if (!window.confirm(`Delete ${t.symbol} on ${nice(t.date)}? This cannot be undone.`)) return;
    await api.deleteTrade(t._id); await reload(); toast('Trade deleted');
  }

  return (
    <>
      <header className="head"><div><h1>Trades</h1><p className="mute">{rows.length} of {trades.length} trades</p></div>
        <Link to="/trade/new" className="btn primary"><Icon n="plus" size={16} /> Add trade</Link></header>
      <div className="filters">
        <select value={seg} onChange={(e) => setSeg(e.target.value)} aria-label="Segment"><option value="all">All segments</option><option value="fno">F&O</option><option value="equity">Equity</option></select>
        <select value={ses} onChange={(e) => setSes(e.target.value)} aria-label="Session"><option value="all">Day + afternoon</option><option value="day">Day trade</option><option value="afternoon">Afternoon trade</option></select>
        <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month"><option value="all">All months</option>{months.map((m) => <option key={m} value={m}>{m}</option>)}</select>
      </div>
      {rows.length === 0 && <div className="panel"><p className="mute">No trades match. Add one or change the filters.</p></div>}
      <div className="list">
        {rows.map((t) => {
          const ev = evals[t._id];
          return (
            <article key={t._id} className="panel trade">
              <button className="trade-main" onClick={() => setOpen(open === t._id ? null : t._id)} aria-expanded={open === t._id}>
                <span className="t-sym"><strong>{t.symbol}</strong><small>{nice(t.date)} · {t.session === 'day' ? 'Day' : 'Afternoon'} · {t.direction === 'long' ? 'Long' : 'Short'} · {t.qty} qty</small></span>
                <span className="t-px">{t.entryPrice} → {t.exitPrice}</span>
                <span className={'t-pnl num ' + tone(t.grossPnl)}>{money(t.grossPnl, true)}<small>net {money(t.netPnl, true)}</small></span>
                <span className={'t-score' + (ev?.broken.length ? ' warn-t' : ' gain')}>{pct(ev?.score)}</span>
              </button>
              {open === t._id && (
                <div className="trade-more">
                  {t.strategy && <p><strong>Strategy:</strong> {t.strategy}{t.outcome && ` · ${t.outcome}`}</p>}
                  {t.analysis && <p><strong>Analysis:</strong> {t.analysis}</p>}
                  {t.psychology?.emotion && <p><strong>Felt:</strong> {t.psychology.emotion} · confidence {t.psychology.confidence}/10 · satisfaction {t.psychology.satisfaction}/10</p>}
                  {!!t.psychology?.mistakes?.length && <p><strong>Mistakes:</strong> {t.psychology.mistakes.join(', ')}</p>}
                  {t.psychology?.lessons && <p><strong>Lesson:</strong> {t.psychology.lessons}</p>}
                  {ev?.broken.length ? <p className="warn-t"><strong>Rules broken:</strong> {ev.broken.map((b) => `${b.label} (rule ${b.rule})`).join('; ')}</p> : <p className="gain">All rules followed.</p>}
                  <div className="row gap">
                    <Link to={`/trade/${t._id}`} className="btn"><Icon n="edit" size={15} /> Edit</Link>
                    <button className="btn danger" onClick={() => del(t)}><Icon n="trash" size={15} /> Delete</button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}
