const P = {
  home: 'M3 11l9-8 9 8M5 10v10h14V10',
  plus: 'M12 5v14M5 12h14',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  pulse: 'M3 12h4l3-8 4 16 3-8h4',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
  download: 'M12 3v12M7 10l5 5 5-5M4 21h16',
  upload: 'M12 15V3M7 8l5-5 5 5M4 21h16',
  refresh: 'M20 11a8 8 0 10-2 6M20 4v7h-7',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  edit: 'M4 20h4L19 9l-4-4L4 16v4z',
  check: 'M5 12l5 5 9-10',
  x: 'M6 6l12 12M18 6L6 18',
  lock: 'M6 11h12v9H6zM9 11V8a3 3 0 016 0v3',
  sun: 'M12 16a4 4 0 100-8 4 4 0 000 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9h.01',
  todo: 'M9 11l3 3 8-8M20 12v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1h11',
  note: 'M5 4h14v16H5zM9 9h6M9 13h6M9 17h3',
  chevL: 'M15 6l-6 6 6 6',
  chevR: 'M9 6l6 6-6 6',
};
export const Icon = ({ n, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={P[n]} />
  </svg>
);

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
export const money = (n, sign = false) => {
  if (n == null || Number.isNaN(n)) return '–';
  const s = n < 0 ? '−' : sign && n > 0 ? '+' : '';
  return `${s}₹${inr.format(Math.abs(n))}`;
};
export const tone = (n) => (n > 0 ? 'gain' : n < 0 ? 'loss' : '');
export const pct = (x) => (x == null ? '–' : `${Math.round(x * 100)}%`);
export const nice = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// Chart colours that follow the theme
export const chartColors = (theme) =>
  theme === 'light'
    ? { grid: '#dde3ef', tick: '#5a6a88', line: '#0891b2', dd: '#e11d48', tip: '#ffffff' }
    : { grid: '#223052', tick: '#8b98b5', line: '#2bd4f5', dd: '#ff6b7d', tip: '#111a2e' };

// Where each exit landed against your rules
export function ExitTrack({ values = [], limits }) {
  const { maxLoss, targetMin, targetMax } = limits;
  const lo = -maxLoss * 1.6, hi = targetMax * 1.25, span = hi - lo;
  const pos = (v) => Math.min(100, Math.max(0, ((v - lo) / span) * 100));
  const zone = (v) => (v < -maxLoss ? 'breach' : v < 0 ? 'loss' : v > targetMax ? 'over' : v >= targetMin ? 'target' : 'gain');
  const mid = (targetMin + targetMax) / 2;
  return (
    <div className="track">
      <div className="track-bar" role="img" aria-label="Exit points against stop and target zones">
        <i className="z breach" style={{ left: 0, width: pos(-maxLoss) + '%' }} />
        <i className="z loss" style={{ left: pos(-maxLoss) + '%', width: pos(0) - pos(-maxLoss) + '%' }} />
        <i className="z open" style={{ left: pos(0) + '%', width: pos(targetMin) - pos(0) + '%' }} />
        <i className="z target" style={{ left: pos(targetMin) + '%', width: pos(targetMax) - pos(targetMin) + '%' }} />
        <i className="z over" style={{ left: pos(targetMax) + '%', right: 0 }} />
        {values.map((v, i) => (
          <b key={i} className={'dot ' + zone(v)} style={{ left: pos(v) + '%' }} title={money(v, true)} />
        ))}
      </div>
      <div className="track-scale">
        <span style={{ left: pos(-maxLoss) + '%' }}>{money(-maxLoss)} stop</span>
        <span style={{ left: pos(0) + '%' }}>0</span>
        <span style={{ left: pos(mid) + '%' }}>{targetMin}–{targetMax} exit</span>
      </div>
    </div>
  );
}

export const Stat = ({ label, value, sub, cls = '' }) => (
  <div className="stat">
    <span className="stat-l">{label}</span>
    <strong className={'stat-v ' + cls}>{value}</strong>
    {sub && <span className="stat-s">{sub}</span>}
  </div>
);

export const Seg = ({ value, onChange, options }) => (
  <div className="seg" role="group">
    {options.map(([v, l]) => (
      <button type="button" key={v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>
    ))}
  </div>
);

export const RANGES = [['7d', '7D'], ['30d', '30D'], ['3m', '3M'], ['all', 'All']];
export const Range = ({ value, onChange }) => (
  <div className="chips" role="group" aria-label="Time range">
    {RANGES.map(([v, l]) => (
      <button type="button" key={v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>
    ))}
  </div>
);

export const Bars = ({ rows }) => {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.net)));
  return rows.length === 0 ? <p className="mute">No data yet.</p> : (
    <div className="ibars">
      {rows.map((r) => (
        <div key={r.key} className="ibar">
          <span>{r.key}<small>{r.n} trades</small></span>
          <div className="ibar-track"><i className={r.net >= 0 ? 'up' : 'dn'} style={{ width: (Math.abs(r.net) / max) * 100 + '%' }} /></div>
          <b className={'num ' + tone(r.net)}>{money(r.net, true)}</b>
        </div>
      ))}
    </div>
  );
};
