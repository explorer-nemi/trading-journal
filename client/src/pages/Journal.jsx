import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useApp } from '../store';
import { ExitTrack, Icon, Seg, money, tone } from '../ui';
import { evaluateTrade, resolveChecks } from '../rules';

const STRATEGIES = ['Breakout', 'Pullback', 'Reversal', 'Support / resistance bounce', 'Trend follow', 'Gap trade', 'Scalp', 'Other'];
const OUTCOMES = ['Full success', 'Partial success', 'Break-even', 'Stopped out', 'Exited early', 'Exited late'];
const EMOTIONS = ['Calm', 'Confident', 'Frustrated', 'Overconfident', 'Anxious', 'Impatient', 'Fearful', 'Greedy'];
export const MISTAKES = ['Overtrading', 'Risked too much', 'Exited too late', 'Ignored signals', 'Ignored stop loss', 'Greed', 'Revenge trading', 'Exited too early', 'FOMO entry', 'No clear plan', 'Against trend', 'No mistakes'];

const NO_TICKS = { slPlaced: false, lossOk: false, confirm5m: false, srLevel: false, expiryOk: false, noOvertrade: false, noGreed: false, targetOk: false };
const blank = (date) => ({
  date, session: 'day', segment: 'fno', underlying: 'NIFTY', optionType: 'CE', strike: '', expiry: '', symbol: '',
  direction: 'long', qty: '', entryPrice: '', exitPrice: '', stopLoss: '', target: '', fees: '',
  strategy: 'Breakout', outcome: '', analysis: '',
  checks: { ...NO_TICKS },
  psychology: { confidence: 5, satisfaction: 5, emotion: '', mistakes: [], lessons: '' },
});
const n = (x) => (x === '' || x == null ? NaN : Number(x));
const priorOf = (trades, date, editing) =>
  trades.filter((t) => t.date === date && t._id !== editing?._id && t.grossPnl < 0 && (!editing || (t.createdAt || '') < (editing.createdAt || ''))).length;

// Shrink a screenshot in the browser so it stays small in the database
function compress(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let max = 1000, q = 0.72, out = '';
      for (let i = 0; i < 4; i++) {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        out = c.toDataURL('image/jpeg', q);
        if (out.length < 350_000) break;
        max *= 0.8; q -= 0.1;
      }
      URL.revokeObjectURL(url);
      resolve(out);
    };
    img.onerror = () => reject(new Error('Could not read that image'));
    img.src = url;
  });
}

export default function Journal() {
  const { id } = useParams();
  const nav = useNavigate();
  const { trades, limits, days, saveDay, reload, toast, today } = useApp();
  const editing = id ? trades.find((t) => t._id === id) : null;

  const [f, setF] = useState(() => {
    if (!editing) return blank(today);
    const b = blank(editing.date);
    return {
      ...b, ...editing,
      strike: editing.strike ?? '', expiry: editing.expiry ?? '', qty: editing.qty ?? '', entryPrice: editing.entryPrice ?? '', exitPrice: editing.exitPrice ?? '',
      stopLoss: editing.stopLoss ?? '', target: editing.target ?? '', fees: editing.fees ?? '',
      checks: resolveChecks(editing, limits, priorOf(trades, editing.date, editing)),
      psychology: { ...b.psychology, ...editing.psychology, mistakes: editing.psychology?.mistakes || [] },
    };
  });
  const [tab, setTab] = useState('general');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [shots, setShots] = useState([]);
  const [shotsReady, setShotsReady] = useState(!editing);
  const [shotsTouched, setShotsTouched] = useState(false);

  useEffect(() => {
    if (!editing) return;
    api.trade(editing._id).then((t) => { setShots(t.screenshots || []); setShotsReady(true); }).catch(() => {});
  }, [editing?._id]);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const setIn = (g, k, v) => setF((p) => ({ ...p, [g]: { ...p[g], [k]: v } }));
  const fno = f.segment === 'fno';

  const gross = [n(f.entryPrice), n(f.exitPrice), n(f.qty)].every(Number.isFinite)
    ? (n(f.exitPrice) - n(f.entryPrice)) * n(f.qty) * (f.direction === 'short' ? -1 : 1) : null;
  const net = gross == null ? null : gross - (n(f.fees) || 0);
  const risk = [n(f.entryPrice), n(f.stopLoss), n(f.qty)].every(Number.isFinite) ? Math.abs(n(f.entryPrice) - n(f.stopLoss)) * n(f.qty) : null;
  const slWrongSide = Number.isFinite(n(f.stopLoss)) && Number.isFinite(n(f.entryPrice)) &&
    (f.direction === 'long' ? n(f.stopLoss) >= n(f.entryPrice) : n(f.stopLoss) <= n(f.entryPrice));

  const priorLosses = useMemo(() => priorOf(trades, f.date, editing), [trades, f.date, editing]);
  const dayLocked = priorLosses >= limits.maxLossTrades;
  const noTradeDay = !!days.find((d) => d.date === f.date)?.noTrade;

  const list = evaluateTrade({ ...f, grossPnl: gross }, limits, priorLosses);
  const done = list.filter((r) => r.ok).length;
  const hint = {
    slPlaced: !(n(f.stopLoss) > 0) ? 'No stop loss price entered' : '',
    lossOk: gross != null && gross < -limits.maxLoss ? `P&L shows a loss beyond ₹${limits.maxLoss}` : '',
    noOvertrade: dayLocked ? `${priorLosses} losing trades already on this date` : '',
  };

  const autoSymbol = () => [f.underlying, f.expiry && f.expiry.slice(5), f.strike, f.optionType].filter(Boolean).join(' ');
  const toggleMistake = (m) => {
    const cur = f.psychology.mistakes;
    let next = cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m];
    if (m === 'No mistakes' && !cur.includes(m)) next = ['No mistakes'];
    else next = next.filter((x) => x !== 'No mistakes' || m === 'No mistakes');
    setIn('psychology', 'mistakes', next);
  };

  async function addShots(files) {
    setErr('');
    try {
      const room = 3 - shots.length;
      const add = [];
      for (const file of [...files].slice(0, room)) add.push(await compress(file));
      if (add.length) { setShots([...shots, ...add]); setShotsTouched(true); }
    } catch (e) { setErr(e.message); }
  }

  async function save() {
    setErr('');
    const body = { ...f, symbol: (f.symbol || (fno ? autoSymbol() : '')).trim() };
    for (const k of ['qty', 'entryPrice', 'exitPrice', 'stopLoss', 'target', 'fees', 'strike']) body[k] = f[k] === '' ? null : Number(f[k]);
    if (!fno) Object.assign(body, { underlying: '', optionType: '', strike: null, expiry: '' });
    if (shotsTouched) body.screenshots = shots;
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

  const field = (label, el, h) => (<label className="field"><span>{label}</span>{el}{h && <small className={h.cls || 'mute'}>{h.t}</small>}</label>);
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
                  {field('Type', <Seg value={f.optionType} onChange={(v) => set('optionType', v)} options={[['CE', 'CE'], ['PE', 'PE'], ['FUT', 'Future']]} />)}
                  {field('Strike', inp('strike', { type: 'number', inputMode: 'numeric', placeholder: '24500' }))}
                  {field('Expiry date', inp('expiry', { type: 'date' }))}
                  {field('Symbol (optional)', inp('symbol', { placeholder: autoSymbol() || 'Auto from the fields above' }))}
                </>) : field('Symbol', inp('symbol', { placeholder: 'RELIANCE' }))}
                {field('Quantity', inp('qty', { type: 'number', inputMode: 'numeric', placeholder: 'Total qty' }))}
                {field('Entry price (₹)', inp('entryPrice', { type: 'number', step: 'any', inputMode: 'decimal' }))}
                {field('Exit price (₹)', inp('exitPrice', { type: 'number', step: 'any', inputMode: 'decimal' }))}
                {field('Stop loss (₹)', inp('stopLoss', { type: 'number', step: 'any', inputMode: 'decimal' }),
                  slWrongSide ? { t: `A ${f.direction} trade needs the SL ${f.direction === 'long' ? 'below' : 'above'} entry`, cls: 'warn-t' }
                    : risk != null ? { t: `Risk if hit: ${money(risk)} (limit ${money(limits.maxLoss)})`, cls: risk > limits.maxLoss ? 'warn-t' : 'mute' } : undefined)}
                {field('Target (₹)', inp('target', { type: 'number', step: 'any', inputMode: 'decimal' }))}
                {field('Fees + taxes (₹)', inp('fees', { type: 'number', step: 'any', inputMode: 'decimal' }))}
                {field('Strategy', <select value={f.strategy} onChange={(e) => set('strategy', e.target.value)}>{STRATEGIES.map((s) => <option key={s}>{s}</option>)}</select>)}
                {field('Outcome', <select value={f.outcome} onChange={(e) => set('outcome', e.target.value)}><option value="">Select outcome</option>{OUTCOMES.map((s) => <option key={s}>{s}</option>)}</select>)}
              </div>
              {field('Trade analysis', <textarea rows="3" value={f.analysis} onChange={(e) => set('analysis', e.target.value)} placeholder="Why did you take this trade? What was your analysis?" />)}

              <div className="field">
                <span>Chart screenshots <small className="mute">(up to 3)</small></span>
                <div className="shots">
                  {shots.map((s, i) => (
                    <div key={i} className="shot">
                      <img src={s} alt={`Screenshot ${i + 1}`} />
                      <button type="button" aria-label="Remove screenshot" onClick={() => { setShots(shots.filter((_, j) => j !== i)); setShotsTouched(true); }}><Icon n="x" size={14} /></button>
                    </div>
                  ))}
                  {shots.length < 3 && (
                    <label className={'shot add' + (shotsReady ? '' : ' off')}>
                      <Icon n="image" size={22} /><span>{shotsReady ? 'Add image' : 'Loading…'}</span>
                      <input type="file" accept="image/*" multiple disabled={!shotsReady} onChange={(e) => { addShots(e.target.files); e.target.value = ''; }} />
                    </label>
                  )}
                </div>
              </div>
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
            <button className="btn" type="button" onClick={() => { setF(blank(today)); setShots([]); setShotsTouched(!!editing); }}>Reset</button>
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

          <div className="row between gap-t"><h2>Rule check</h2><span className="score">{done}/{list.length}</span></div>
          <div className="meter"><i style={{ width: (list.length ? (done / list.length) * 100 : 0) + '%' }} /></div>
          <ul className="rules">
            {list.map((r) => (
              <li key={r.id} className={r.ok ? 'ok' : 'bad'}>
                <label className="tick">
                  <input type="checkbox" checked={!!f.checks[r.id]} onChange={(e) => setIn('checks', r.id, e.target.checked)} />
                  <span className="box"><Icon n="check" size={13} /></span>
                  <span>{r.label}</span>
                </label>
                <small>Rule {r.rule}</small>
                {hint[r.id] && <em className="hint warn-t">{hint[r.id]}</em>}
              </li>
            ))}
          </ul>
          <p className="mute small">Tick only what you really did. Honest ticks make your discipline score useful.</p>
        </aside>
      </div>
    </>
  );
}
