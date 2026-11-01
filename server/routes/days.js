import { Router } from 'express';
import Day from '../models/Day.js';
import { requireDb, wrap } from '../util.js';

const router = Router();
router.use(requireDb);

router.get('/', wrap(async (_req, res) => res.json(await Day.find().lean())));

router.put('/:date', wrap(async (req, res) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(req.params.date)) return res.status(400).json({ error: 'Date must be YYYY-MM-DD' });
  const set = {};
  if (req.body.noTrade !== undefined) set.noTrade = !!req.body.noTrade;
  if (req.body.note !== undefined) set.note = String(req.body.note).slice(0, 5000);
  if (Array.isArray(req.body.todos)) {
    set.todos = req.body.todos
      .slice(0, 50)
      .map((t) => ({ text: String(t.text || '').trim().slice(0, 200), done: !!t.done }))
      .filter((t) => t.text);
  }
  const doc = await Day.findOneAndUpdate({ date: req.params.date }, { $set: set }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
  res.json(doc);
}));

export default router;