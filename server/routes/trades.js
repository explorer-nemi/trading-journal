import { Router } from 'express';
import mongoose from 'mongoose';
import Trade from '../models/Trade.js';
import { requireDb, wrap } from '../util.js';

const router = Router();
router.use(requireDb);

const FIELDS = [
  'date', 'session', 'segment', 'underlying', 'optionType', 'strike', 'expiry', 'symbol',
  'direction', 'qty', 'entryPrice', 'exitPrice', 'stopLoss', 'target', 'fees',
  'strategy', 'outcome', 'analysis', 'checks', 'psychology',
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
  return { set, unset };
}

router.get('/', wrap(async (_req, res) => {
  res.json(await Trade.find().sort({ date: -1, createdAt: -1 }).lean());
}));

router.post('/', wrap(async (req, res) => {
  const { set } = build(req.body);
  res.status(201).json(await Trade.create(set));
}));

router.put('/:id', wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Bad id' });
  const { set, unset } = build(req.body);
  const update = { $set: set };
  if (Object.keys(unset).length) update.$unset = unset;
  const doc = await Trade.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
  if (!doc) return res.status(404).json({ error: 'Trade not found' });
  res.json(doc);
}));

router.delete('/:id', wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Bad id' });
  await Trade.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
}));

export default router;
