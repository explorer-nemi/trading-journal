import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useApp } from '../store';
import { exportCsv, parseCsv, rowToTrade } from '../csv';
import { Icon, money, nice, pct, tone } from '../ui';
import { sum } from '../rules';

function Shots({ id }) {
  const [list, setList] = useState(null);
  const [big, setBig] = useState(null);
  useEffect(() => { api.trade(id).then((t) => setList(t.screenshots || [])).catch(() => setList([])); }, [id]);
  if (list === null) return <p className="mute small">Loading screenshots…</p>;
  return (
    <>
      <div className="shots view">{list.map((s, i) => <button key={i} className="shot" onClick={() => setBig(s)}><img src={s} alt={`Screenshot ${i + 1}`} /></button>)}</div>
      {big && <div className="lightbox" role="dialog" aria-label="Screenshot" onClick={() => setBig(null)}><img src={big} alt="Screenshot enlarged" /></div>}
    </>
  );
}

export default function Trades() {
  const { trades, evals, reload, toast } = useApp();
  const [seg, setSeg] = useState('all');
  const [ses, setSes] = useState('all');
  const [month, setMonth] = useState('all');
  const [open, setOpen] = useState(null);
  const fileRef = useRef();

  const months = [...new Set(trades.map((t) => t.date.slice(0, 7)))];
  const rows = trades.filter((t) => (seg === 'all' || t.segment === seg) && (ses === 'all' || t.session === ses) && (month === 'all' || t.date.startsWith(month)));

  async function del(t) {
    if (!window.confirm(`Delete ${t.symbol} on ${nice(t.date)}? This cannot be undone.`)) return;
    await api.deleteTrade(t._id); await reload(); toast('Trade deleted');
  }

  async function importFile(file) {
    if (!file) return;
    try {
      const parsed = parseCsv(await file.text());
      const good = parsed.map(rowToTrade).filter(Boolean);
      if (!good.length) return toast('No valid trades found. Use the Export file as a template.');
      if (!window.confirm(`Import ${good.length} trades (${parsed.length - good.length} rows skipped)?`)) return;
      const r = await api.bulkTrades(good);
      await reload();
      toast(`Imported ${r.imported} trades`);
    } catch (e) { toast(e.message); }
  }

  return (
    <>
      <header className="head">
        <div><h1>Trades</h1><p className="mute">{rows.length} of {trades.length} trades · gross <span className={'num ' + tone(sum(rows, 'grossPnl'))}>{money(sum(rows, 'grossPnl'), true)}</span></p></div>
        <div className="row gap wrap">
          <button className="btn" onClick={() => fileRef.current.click()}><Icon n="upload" size={16} /> Import CSV</button>
          <button className="btn" onClick={() => exportCsv(trades)}><Icon n="download" size={16} /> Export</button>
          <Link to="/trade/new" className="btn primary"><Icon n="plus" size={16} /> Add trade</Link>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { importFile(e.target.files[0]); e.target.value = ''; }} />
        </div>
      </header>
      <div className="filters">
        <select value={seg} onChange={(e) => setSeg(e.target.value)} aria-label="Segment"><option value="all">All segments</option><option value="fno">F&O</option><option value="equity">Equity</option></select>
        <select value={ses} onChange={(e) => setSes(e.target.value)} aria-label="Session"><option value="all">Day + afternoon</option><option value="day">Day trade</option><option value="afternoon">Afternoon trade</option></select>
        <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month"><option value="all">All months</option>{months.map((m) => <option key={m} value={m}>{m}</option>)}</select>
      </div>
      {rows.length === 0 && <div className="panel"><p className="mute">No trades match. Add one, import a CSV, or change the filters.</p></div>}
      <div className="list">
        {rows.map((t) => {
          const ev = evals[t._id];
          return (
            <article key={t._id} className="panel trade">
              <button className="trade-main" onClick={() => setOpen(open === t._id ? null : t._id)} aria-expanded={open === t._id}>
                <span className="t-sym"><strong>{t.symbol}</strong><small>{nice(t.date)} · {t.session === 'day' ? 'Day' : 'Afternoon'} · {t.direction === 'long' ? 'Long' : 'Short'} · {t.qty} qty{t.shotCount > 0 && ' · 📷'}</small></span>
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
                  {t.shotCount > 0 && <Shots id={t._id} />}
                  {ev?.broken.length ? <p className="warn-t"><strong>Rules not followed:</strong> {ev.broken.map((b) => `${b.label} (rule ${b.rule})`).join('; ')}</p> : <p className="gain">All rules followed.</p>}
                  <div className="row gap">
                    <Link to={`/trade/${t._id}`} className="btn sm"><Icon n="edit" size={15} /> Edit</Link>
                    <button className="btn sm danger" onClick={() => del(t)}><Icon n="trash" size={15} /> Delete</button>
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