import { Router } from 'express';
import mongoose from 'mongoose';
import Trade from '../models/Trade.js';
import { requireDb, wrap } from '../util.js';

const router = Router();
router.use(requireDb);

const FIELDS = [
  'date', 'session', 'segment', 'underlying', 'optionType', 'strike', 'expiry', 'symbol',
  'direction', 'qty', 'entryPrice', 'exitPrice', 'stopLoss', 'target', 'fees',
  'strategy', 'outcome', 'analysis', 'checks', 'psychology', 'screenshots',
];
const r2 = (n) => Math.round(n * 100) / 100;

// Whitelist fields and compute P&L on the server so saved numbers can't drift.
function build(body) {
  const set = {};
  const unset = {};
  for (const k of FIELDS) {
    const v = body[k];
    if (v === undefined) continue;
    if (v === null || v === '') unset[k] = '';
    else set[k] = v;
  }
  const qty = Number(set.qty), entry = Number(set.entryPrice), exit = Number(set.exitPrice);
  if (![qty, entry, exit].every(Number.isFinite) || qty <= 0) {
    const err = new Error('Quantity, entry price and exit price are required numbers.');
    err.status = 400;
    throw err;
  }
  const dir = set.direction === 'short' ? -1 : 1;
  set.grossPnl = r2((exit - entry) * qty * dir);
  set.netPnl = r2(set.grossPnl - Number(set.fees || 0));
  if (Array.isArray(set.screenshots)) {
    set.screenshots = set.screenshots
      .filter((s) => typeof s === 'string' && s.startsWith('data:image/') && s.length < 450_000)
      .slice(0, 3);
    set.shotCount = set.screenshots.length;
  }
  return { set, unset };
}

router.get('/', wrap(async (_req, res) => {
  res.json(await Trade.find().sort({ date: -1, createdAt: -1 }).lean());
}));

// One trade including its screenshots
router.get('/:id', wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Bad id' });
  const doc = await Trade.findById(req.params.id).select('+screenshots').lean();
  if (!doc) return res.status(404).json({ error: 'Trade not found' });
  res.json(doc);
}));

// CSV import: the browser sends rows already parsed
router.post('/bulk', wrap(async (req, res) => {
  const list = Array.isArray(req.body.trades) ? req.body.trades.slice(0, 500) : [];
  const docs = [];
  let skipped = 0;
  for (const b of list) {
    try {
      const { set } = build({ ...b, screenshots: undefined });
      const d = new Trade(set);
      if (d.validateSync()) { skipped++; continue; }
      docs.push(d);
    } catch { skipped++; }
  }
  if (docs.length) await Trade.insertMany(docs);
  res.status(201).json({ imported: docs.length, skipped });
}));

router.post('/', wrap(async (req, res) => {
  const { set } = build(req.body);
  const doc = await Trade.create(set);
  res.status(201).json({ _id: doc._id });
}));

router.put('/:id', wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Bad id' });
  const { set, unset } = build(req.body);
  const update = { $set: set };
  if (Object.keys(unset).length) update.$unset = unset;
  const doc = await Trade.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
  if (!doc) return res.status(404).json({ error: 'Trade not found' });
  res.json({ _id: doc._id });
}));

router.delete('/:id', wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Bad id' });
  await Trade.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
}));

export default router;
