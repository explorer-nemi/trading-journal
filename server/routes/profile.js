import { Router } from 'express';
import Profile from '../models/Profile.js';
import { requireDb, wrap } from '../util.js';

const router = Router();
router.use(requireDb);

// Rule limits are fixed in the app now, so only personal details are editable here.
const FIELDS = ['displayName', 'broker', 'startingCapital'];

const getOrCreate = () =>
  Profile.findOneAndUpdate({ key: 'me' }, { $setOnInsert: { key: 'me' } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();

router.get('/', wrap(async (_req, res) => res.json(await getOrCreate())));

router.put('/', wrap(async (req, res) => {
  const set = {};
  for (const k of FIELDS) if (req.body[k] !== undefined) set[k] = req.body[k];
  const doc = await Profile.findOneAndUpdate({ key: 'me' }, { $set: set }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }).lean();
  res.json(doc);
}));

export default router;


