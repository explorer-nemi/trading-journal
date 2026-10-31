const KEY = 'tradelog_key';
export const getKey = () => localStorage.getItem(KEY) || '';
export const setKey = (k) => localStorage.setItem(KEY, k);

async function req(path, opts = {}) {
  const r = await fetch('/api' + path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', 'x-app-key': getKey() },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.error || 'Request failed'), { code: r.status, detail: data.detail });
  return data;
}

export const api = {
  trades: () => req('/trades'),
  addTrade: (b) => req('/trades', { method: 'POST', body: b }),
  updateTrade: (id, b) => req('/trades/' + id, { method: 'PUT', body: b }),
  deleteTrade: (id) => req('/trades/' + id, { method: 'DELETE' }),
  profile: () => req('/profile'),
  saveProfile: (b) => req('/profile', { method: 'PUT', body: b }),
  days: () => req('/days'),
  saveDay: (date, b) => req('/days/' + date, { method: 'PUT', body: b }),
  oi: (expiry, nearDays) => req(`/nifty/oi?nearDays=${nearDays ?? 1}` + (expiry ? `&expiry=${encodeURIComponent(expiry)}` : '')),
};
