import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useOi } from '../oi';
import { useApp } from '../store';
import { Icon, Stat } from '../ui';
import { marketOpen } from '../rules';

const lakh = (n) => (n >= 1e5 ? (n / 1e5).toFixed(2) + 'L' : n.toLocaleString('en-IN'));
const inr = (n) => n?.toLocaleString('en-IN', { maximumFractionDigits: 2 });

// Compact strip for the dashboard
export function OiStrip() {
  const { limits } = useApp();
  const { data, error, loading } = useOi(undefined, limits.expiryNearDays);
  return (
    <Link to="/oi" className="panel oi-strip">
      <div className="strip-title"><Icon n="pulse" /> Nifty 50 live OI {data?.stale && <em className="warn-t">stale</em>}</div>
      {data ? (
        <div className="strip-grid">
          <Stat label="Spot" value={inr(data.spot)} />
          <Stat label="PCR" value={data.pcr ?? '–'} />
          <Stat label="Support" value={data.support} sub="most put OI" cls="gain" />
          <Stat label="Resistance" value={data.resistance} sub="most call OI" cls="loss" />
        </div>
      ) : (
        <p className="mute">{loading ? 'Loading live data…' : error || 'Feed unavailable'}</p>
      )}
    </Link>
  );
}

export default function OiPage() {
  const { limits } = useApp();
  const [expiry, setExpiry] = useState();
  const { data, error, loading, reload } = useOi(expiry, limits.expiryNearDays);
  const open = marketOpen();
  const maxOI = data ? Math.max(...data.rows.flatMap((r) => [r.ceOI, r.peOI]), 1) : 1;
  const sel = data?.expiries.find((e) => e.date === data.selectedExpiry);

  return (
    <>
      <header className="head">
        <div>
          <h1>Nifty 50 open interest</h1>
          <p className="mute">{open ? 'Market open: refreshes every 30 seconds' : 'Market closed: showing the last session'}{data?.asOf && ` · NSE time ${data.asOf}`}</p>
        </div>
        <button className="btn" onClick={reload}><Icon n="refresh" size={16} /> Refresh</button>
      </header>

      {error && (
        <div className="banner stop">
          <strong>{data ? 'Showing older data.' : 'Live OI feed unavailable.'}</strong> {error}
          {!data && <span> NSE often blocks servers outside India. Run the app on your own PC or an India-region server.</span>}
        </div>
      )}
      {data?.stale && !error && <div className="banner warn">NSE did not respond, showing the last good snapshot.</div>}
      {data?.expiryNear && data.selectedExpiry === data.nearestExpiry && (
        <div className="banner warn">Rule 4: the nearest expiry is very close. Take the next expiry ({data.suggestedExpiry}).</div>
      )}

      {loading && !data && <p className="mute">Loading…</p>}
      {data && (
        <>
          <section className="kpis">
            <Stat label="Nifty spot" value={inr(data.spot)} sub={`ATM ${data.atm}`} />
            <Stat label="PCR (put/call OI)" value={data.pcr ?? '–'} sub={data.pcr > 1.2 ? 'More put OI than calls' : data.pcr < 0.8 ? 'More call OI than puts' : 'Fairly balanced'} />
            <Stat label="Support" value={data.support} sub="highest put OI nearby" cls="gain" />
            <Stat label="Resistance" value={data.resistance} sub="highest call OI nearby" cls="loss" />
          </section>

          <section className="panel">
            <div className="row between wrap">
              <h2>Strikes around the money</h2>
              <label className="inline">Expiry
                <select value={data.selectedExpiry} onChange={(e) => setExpiry(e.target.value)}>
                  {data.expiries.map((e) => (
                    <option key={e.date} value={e.date}>{e.date} · {e.dte}d{e.date === data.suggestedExpiry ? ' · suggested' : ''}</option>
                  ))}
                </select>
              </label>
            </div>
            {sel && <p className="mute small">Open interest is the number of contracts still open. Big call OI often acts as resistance, big put OI as support. This is context for your 5 min confirmation, not a signal.</p>}
            <div className="oi-table" role="table">
              <div className="oi-row oi-h" role="row"><span>Call OI</span><span>Chg</span><span>Strike</span><span>Chg</span><span>Put OI</span></div>
              {data.rows.map((r) => (
                <div key={r.strike} className={'oi-row' + (r.strike === data.atm ? ' atm' : '')} role="row">
                  <span className="bar ce"><i style={{ width: (r.ceOI / maxOI) * 100 + '%' }} /><b>{lakh(r.ceOI)}</b></span>
                  <span className={r.ceChg >= 0 ? 'gain' : 'loss'}>{lakh(r.ceChg)}</span>
                  <strong className={'k' + (r.strike === data.resistance ? ' res' : '') + (r.strike === data.support ? ' sup' : '')}>{r.strike}</strong>
                  <span className={r.peChg >= 0 ? 'gain' : 'loss'}>{lakh(r.peChg)}</span>
                  <span className="bar pe"><i style={{ width: (r.peOI / maxOI) * 100 + '%' }} /><b>{lakh(r.peOI)}</b></span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}
