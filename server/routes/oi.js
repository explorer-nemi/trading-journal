import { Router } from 'express';
import { getNiftyOI } from '../services/nse.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const win = Math.min(30, Math.max(4, Number(req.query.win) || 12));
    const nearDays = req.query.nearDays === undefined ? 1 : Number(req.query.nearDays);
    res.json(await getNiftyOI({ expiry: req.query.expiry, win, nearDays: Number.isFinite(nearDays) ? nearDays : 1 }));
  } catch (e) {
    res.status(503).json({ error: 'Live OI feed unavailable', detail: e.message });
  }
});

export default router;
