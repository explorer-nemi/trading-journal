import { useEffect, useState } from 'react';
import { useApp } from '../store';
import { Icon, money, nice, tone } from '../ui';
import { sum } from '../rules';

const QUICK = ['Mark support and resistance levels', 'Check Nifty OI and PCR', 'Re-read my 7 rules', 'Decide max trades for today', 'Review yesterday’s mistakes'];

export default function Planner() {
  const { days, trades, today, saveDay, toast } = useApp();
  const [date, setDate] = useState(today);
  const day = days.find((d) => d.date === date);
  const todos = day?.todos || [];
  const [text, setText] = useState('');
  const [note, setNote] = useState(day?.note || '');
  useEffect(() => setNote(day?.note || ''), [date, day?.note]);

  const shift = (k) => { const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + k); setDate(d.toISOString().slice(0, 10)); };
  const addTodo = (t) => { const v = (t ?? text).trim(); if (!v) return; saveDay(date, { todos: [...todos, { text: v, done: false }] }); setText(''); };
  const toggle = (i) => saveDay(date, { todos: todos.map((t, j) => (j === i ? { ...t, done: !t.done } : t)) });
  const remove = (i) => saveDay(date, { todos: todos.filter((_, j) => j !== i) });
  const saveNote = async () => { if (note !== (day?.note || '')) { await saveDay(date, { note }); toast('Note saved'); } };

  const dayTrades = trades.filter((t) => t.date === date);
  const doneN = todos.filter((t) => t.done).length;
  const recent = [...days].filter((d) => d.note && d.date !== date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);

  return (
    <>
      <header className="head">
        <div><h1>Daily planner</h1><p className="mute">Your to-do list and notes for the day</p></div>
        <div className="datenav">
          <button className="icon-btn" onClick={() => shift(-1)} aria-label="Previous day"><Icon n="chevL" /></button>
          <input type="date" value={date} max="2100-01-01" onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Date" />
          <button className="icon-btn" onClick={() => shift(1)} aria-label="Next day"><Icon n="chevR" /></button>
          {date !== today && <button className="btn sm" onClick={() => setDate(today)}>Today</button>}
        </div>
      </header>

      <div className="two-col">
        <section className="panel">
          <div className="row between"><h2>To-do · {nice(date)}</h2><span className="score">{doneN}/{todos.length}</span></div>
          <form className="addrow" onSubmit={(e) => { e.preventDefault(); addTodo(); }}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a task and press Enter" maxLength={200} />
            <button className="btn primary" type="submit"><Icon n="plus" size={16} /> Add</button>
          </form>
          {todos.length === 0 && (
            <div className="quick">
              <span className="mute small">Quick add</span>
              {QUICK.map((q) => <button key={q} type="button" className="chip" onClick={() => addTodo(q)}>{q}</button>)}
            </div>
          )}
          <ul className="todo">
            {todos.map((t, i) => (
              <li key={t._id || i}>
                <label className="tick"><input type="checkbox" checked={t.done} onChange={() => toggle(i)} /><span className="box"><Icon n="check" size={13} /></span><span className={t.done ? 'done' : ''}>{t.text}</span></label>
                <button className="icon-btn sm" onClick={() => remove(i)} aria-label={`Delete task ${t.text}`}><Icon n="trash" size={15} /></button>
              </li>
            ))}
          </ul>
        </section>

        <div className="stack">
          <section className="panel">
            <div className="row between"><h2>Notes for the day</h2><button className="btn sm" onClick={saveNote}>Save note</button></div>
            <textarea className="note" rows="8" value={note} onChange={(e) => setNote(e.target.value)} onBlur={saveNote} placeholder="Market view, what happened, how you felt, lessons for tomorrow…" maxLength={5000} />
            <div className="row between small mute">
              <span>{dayTrades.length} trades · <span className={'num ' + tone(sum(dayTrades, 'grossPnl'))}>{money(sum(dayTrades, 'grossPnl'), true)}</span> gross</span>
              <label className="switch"><input type="checkbox" checked={!!day?.noTrade} onChange={(e) => saveDay(date, { noTrade: e.target.checked })} /><span className="knob" /> No trade day</label>
            </div>
          </section>
          {recent.length > 0 && (
            <section className="panel">
              <h2>Recent notes</h2>
              {recent.map((d) => (
                <button key={d.date} className="mini btnlike" onClick={() => setDate(d.date)}>
                  <span><strong>{nice(d.date)}</strong><small>{d.note.slice(0, 90)}{d.note.length > 90 ? '…' : ''}</small></span>
                </button>
              ))}
            </section>
          )}
        </div>
      </div>
    </>
  );
}