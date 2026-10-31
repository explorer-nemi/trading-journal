import mongoose from 'mongoose';

export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const requireDb = (_req, res, next) => {
  if (mongoose.connection.readyState === 1) return next();
  res.status(503).json({
    error: 'Database not connected. Check MONGODB_URI in .env and the Atlas Network Access list.',
  });
};
