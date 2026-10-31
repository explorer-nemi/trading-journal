import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useApp } from '../store';
import { ExitTrack, Icon, Seg, money, tone } from '../ui';
import { evaluateTrade } from '../rules';

const STRATEGIES = ['Breakout', 'Pullback', 'Reversal', 'Support / resistance bounce', 'Trend follow', 'Gap trade', 'Scalp', 'Other'];
const OUTCOMES = ['Full success', 'Partial success', 'Break-even', 'Stopped out', 'Exited early', 'Exited late'];
const EMOTIONS = ['Calm', 'Confident', 'Frustrated', 'Overconfident', 'Anxious', 'Impatient', 'Fearful', 'Greedy'];
export const MISTAKES = ['Overtrading', 'Risked too much', 'Exited too late', 'Ignored signals', 'Ignored stop loss', 'Greed', 'Revenge trading', 'Exited too early', 'FOMO entry', 'No clear plan', 'Against trend', 'No mistakes'];

const blank = (date) => ({
  date, session: 'day', segment: 'fno', underlying: 'NIFTY', optionType: 'CE', strike: '', expiry: '', symbol: '',
  direction: 'long', qty: '', entryPrice: '', exitPrice: '', stopLoss: '', target: '', fees: '',
  strategy: 'Breakout', outcome: '', analysis: '',
  checks: { confirm5m: false, srLevel: false, expiryOk: false, noGreed: false },
  psychology: { confidence: 5, satisfaction: 5, emotion: '', mistakes: [], lessons: '' },
});
const fromTrade = (t) => ({
  ...blank(t.date), ...t,
  strike: t.strike ?? '', expiry: t.expiry ?? '', qty: t.qty ?? '', entryPrice: t.entryPrice ?? '', exitPrice: t.exitPrice ?? '',
  stopLoss: t.stopLoss ?? '', target: t.target ?? '', fees: t.fees ?? '',
  checks: { ...blank().checks, ...t.checks }, psychology: { ...blank().psychology, ...t.psychology, mistakes: t.psychology?.mistakes || [] },
});
const n = (x) => (x === '' || x == null ? NaN : Number(x));

export default function Journal() {
  const { id } = useParams();
  const nav = useNavigate();
  const { trades, limits, days, saveDay, reload, toast, today } = useApp();
  const editing = id ? trades.find((t) => t._id === id) : null;
  const [f, setF] = useState(() => (editing ? fromTrade(editing) : blank(today)));
  const [tab, setTab] = useState('general');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const setIn = (g, k, v) => setF((p) => ({ ...p, [g]: { ...p[g], [k]: v } }));
  const fno = f.segment === 'fno';

  const gross = [n(f.entryPrice), n(f.exitPrice), n(f.qty)].every(Number.isFinite)
    ? (n(f.exitPrice) - n(f.entryPrice)) * n(f.qty) * (f.direction === 'short' ? -1 : 1) : null;
  const net = gross == null ? null : gross - (n(f.fees) || 0);
  const risk = [n(f.entryPrice), n(f.stopLoss), n(f.qty)].every(Number.isFinite) ? Math.abs(n(f.entryPrice) - n(f.stopLoss)) * n(f.qty) : null;
  const slWrongSide = Number.isFinite(n(f.stopLoss)) && Number.isFinite(n(f.entryPrice)) &&
    (f.direction === 'long' ? n(f.stopLoss) >= n(f.entryPrice) : n(f.stopLoss) <= n(f.entryPrice));

  const priorLosses = useMemo(() => trades.filter((t) =>
    t.date === f.date && t._id !== editing?._id && t.grossPnl < 0 && (!editing || t.createdAt < editing.createdAt)).length, [trades, f.date, editing]);
  const dayLocked = priorLosses >= limits.maxLossTrades;
  const noTradeDay = !!days.find((d) => d.date === f.date)?.noTrade;
  const list = evaluateTrade({ ...f, grossPnl: gross, stopLoss: n(f.stopLoss) }, limits, priorLosses);

  const autoSymbol = () => [f.underlying, f.expiry && f.expiry.slice(5), f.strike, f.optionType].filter(Boolean).join(' ');
  const toggleMistake = (m) => {
    const cur = f.psychology.mistakes;
    let next = cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m];
    if (m === 'No mistakes' && !cur.includes(m)) next = ['No mistakes'];
    else next = next.filter((x) => x !== 'No mistakes' || m === 'No mistakes');
    setIn('psychology', 'mistakes', next);
  };

  async function save() {
    setErr('');
    const body = { ...f, symbol: (f.symbol || (fno ? autoSymbol() : '')).trim() };
    for (const k of ['qty', 'entryPrice', 'exitPrice', 'stopLoss', 'target', 'fees', 'strike']) body[k] = f[k] === '' ? null : Number(f[k]);
    if (!fno) Object.assign(body, { underlying: '', optionType: '', strike: null, expiry: '' });
    if (!body.symbol) return setErr(fno ? 'Enter the strike so the contract can be named, or type a symbol.' : 'Enter the stock symbol.');
    if (!(body.qty > 0) || body.entryPrice == null || body.exitPrice == null) return setErr('Quantity, entry price and exit price are required.');
    try {
      setBusy(true);
      if (editing) await api.updateTrade(editing._id, body); else await api.addTrade(body);
      await reload();
      toast(editing ? 'Trade updated' : 'Trade saved');
      nav('/trades');
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  const field = (label, el, hint) => (<label className="field"><span>{label}</span>{el}{hint && <small className={hint.cls || 'mute'}>{hint.t}</small>}</label>);
  const inp = (k, props = {}) => <input value={f[k]} onChange={(e) => set(k, e.target.value)} {...props} />;

  return (
    <>
      <header className="head">
        <div><h1>{editing ? 'Edit trade' : 'Trade journal'}</h1><p className="mute">Capture setup, execution and psychology in one flow</p></div>
        <label className="switch">
          <input type="checkbox" checked={noTradeDay} onChange={(e) => saveDay(f.date, { noTrade: e.target.checked })} />
          <span className="knob" /> No trade day
        </label>
      </header>

      {dayLocked && <div className="banner stop"><strong>Rule 5.</strong> You already have {priorLosses} losing trades on this date. The plan says stop for the day. You can still record the trade so the journal stays honest.</div>}

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'general'} className={tab === 'general' ? 'on' : ''} onClick={() => setTab('general')}>General</button>
        <button role="tab" aria-selected={tab === 'psych'} className={tab === 'psych' ? 'on' : ''} onClick={() => setTab('psych')}>Psychology</button>
      </div>

      <div className="split">
        <section className="panel form">
          {tab === 'general' ? (
            <>
              <div className="row wrap gap">
                <Seg value={f.segment} onChange={(v) => set('segment', v)} options={[['fno', 'F&O'], ['equity', 'Equity']]} />
                <Seg value={f.session} onChange={(v) => set('session', v)} options={[['day', 'Day trade'], ['afternoon', 'Afternoon trade']]} />
                <Seg value={f.direction} onChange={(v) => set('direction', v)} options={[['long', 'Long / Buy'], ['short', 'Short / Sell']]} />
              </div>
              <div className="grid">
                {field('Date', inp('date', { type: 'date', max: today }))}
                {fno ? (<>
                  {field('Index', <Seg value={f.underlying} onChange={(v) => set('underlying', v)} options={[['NIFTY', 'Nifty'], ['SENSEX', 'Sensex']]} />)}
                  {field('Type', <Seg value={f.optionType} onChange={(v) => set('optionType', v)} options={[['CE', 'Call CE'], ['PE', 'Put PE'], ['FUT', 'Future']]} />)}
                  {field('Strike', inp('strike', { type: 'number', inputMode: 'numeric', placeholder: '24500' }))}
                  {field('Expiry date', inp('expiry', { type: 'date' }))}
                  {field('Symbol (optional)', inp('symbol', { placeholder: autoSymbol() || 'Auto from the fields above' }))}
                </>) : field('Symbol', inp('symbol', { placeholder: 'RELIANCE' }))}
                {field('Quantity', inp('qty', { type: 'number', inputMode: 'numeric', placeholder: 'Total qty' }))}
                {field('Entry price (₹)', inp('entryPrice', { type: 'number', step: 'any', inputMode: 'decimal' }))}
                {field('Exit price (₹)', inp('exitPrice', { type: 'number', step: 'any', inputMode: 'decimal' }))}
                {field('Stop loss (₹)', inp('stopLoss', { type: 'number', step: 'any', inputMode: 'decimal' }),
                  slWrongSide ? { t: `A ${f.direction} trade needs the SL ${f.direction === 'long' ? 'below' : 'above'} entry`, cls: 'warn-t' }
                    : risk != null ? { t: `Risk if hit: ${money(risk)} (your limit ${money(limits.maxLoss)})`, cls: risk > limits.maxLoss ? 'warn-t' : 'mute' } : undefined)}
                {field('Target (₹)', inp('target', { type: 'number', step: 'any', inputMode: 'decimal' }))}
                {field('Fees + taxes (₹)', inp('fees', { type: 'number', step: 'any', inputMode: 'decimal' }))}
                {field('Strategy', <select value={f.strategy} onChange={(e) => set('strategy', e.target.value)}>{STRATEGIES.map((s) => <option key={s}>{s}</option>)}</select>)}
                {field('Outcome', <select value={f.outcome} onChange={(e) => set('outcome', e.target.value)}><option value="">Select outcome</option>{OUTCOMES.map((s) => <option key={s}>{s}</option>)}</select>)}
              </div>
              {field('Trade analysis', <textarea rows="3" value={f.analysis} onChange={(e) => set('analysis', e.target.value)} placeholder="Why did you take this trade? What was your analysis?" />)}
            </>
          ) : (
            <>
              <div className="grid two">
                <div>
                  {field(`Entry confidence: ${f.psychology.confidence}/10`, <input type="range" min="1" max="10" value={f.psychology.confidence} onChange={(e) => setIn('psychology', 'confidence', +e.target.value)} />)}
                  {field(`Satisfaction: ${f.psychology.satisfaction}/10`, <input type="range" min="1" max="10" value={f.psychology.satisfaction} onChange={(e) => setIn('psychology', 'satisfaction', +e.target.value)} />)}
                  {field('Emotional state during trade', <select value={f.psychology.emotion} onChange={(e) => setIn('psychology', 'emotion', e.target.value)}><option value="">Select emotional state</option>{EMOTIONS.map((s) => <option key={s}>{s}</option>)}</select>)}
                </div>
                <fieldset className="mistakes"><legend>Mistakes made</legend>
                  {MISTAKES.map((m) => (
                    <label key={m} className={'chk' + (f.psychology.mistakes.includes(m) ? ' on' : '')}>
                      <input type="checkbox" checked={f.psychology.mistakes.includes(m)} onChange={() => toggleMistake(m)} />{m}
                    </label>
                  ))}
                </fieldset>
              </div>
              {field('Lessons learned', <textarea rows="4" value={f.psychology.lessons} onChange={(e) => setIn('psychology', 'lessons', e.target.value)} placeholder="What did you learn from this trade?" />)}
            </>
          )}
          {err && <div className="banner stop" role="alert">{err}</div>}
          <div className="row end gap">
            <button className="btn" type="button" onClick={() => setF(editing ? fromTrade(editing) : blank(today))}>Reset</button>
            <button className="btn primary" type="button" disabled={busy} onClick={save}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Save trade'}</button>
          </div>
        </section>

        <aside className="panel side">
          <h2>This trade</h2>
          <div className="pnl-big">
            <span className={tone(gross)}>{gross == null ? '₹–' : money(gross, true)}</span>
            <small>Gross before tax{net != null && <> · net {money(net, true)}</>}</small>
          </div>
          {gross != null && <ExitTrack values={[gross]} limits={limits} />}
          <h2 className="gap-t">Rule check</h2>
          <ul className="rules">
            {list.map((r) => (
              <li key={r.id} className={r.ok ? 'ok' : 'bad'}>
                <Icon n={r.ok ? 'check' : 'x'} size={16} />
                {r.auto ? <span>{r.label}</span> : (
                  <label><input type="checkbox" checked={!!f.checks[r.id]} onChange={(e) => setIn('checks', r.id, e.target.checked)} /> {r.label}</label>
                )}
                <small>Rule {r.rule}</small>
              </li>
            ))}
          </ul>
          <p className="mute small">Tick what you actually did. Honest ticks make the discipline score useful.</p>
        </aside>
      </div>
    </>
  );
}
