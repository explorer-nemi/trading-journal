import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import tradesRouter from './routes/trades.js';
import profileRouter from './routes/profile.js';
import daysRouter from './routes/days.js';
import oiRouter from './routes/oi.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, db: mongoose.connection.readyState === 1 }));

// No login page. If APP_KEY is set, every API call must carry it (the app asks once per device).
app.use('/api', (req, res, next) => {
  const key = process.env.APP_KEY;
  if (!key || req.get('x-app-key') === key) return next();
  res.status(401).json({ error: 'Access key required' });
});

app.use('/api/trades', tradesRouter);
app.use('/api/profile', profileRouter);
app.use('/api/days', daysRouter);
app.use('/api/nifty/oi', oiRouter);

// Serve the built React app
const dist = path.join(__dirname, '../client/dist');
app.use(express.static(dist));
app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));

app.use((err, _req, res, _next) => {
  console.error(err);
  const code = err.status || (err.name === 'ValidationError' ? 400 : 500);
  res.status(code).json({ error: err.message });
});

const PORT = process.env.PORT || 5000;
if (!process.env.MONGODB_URI) console.warn('MONGODB_URI is not set. Copy server/.env.example to server/.env');
else {
  mongoose
    .connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 })
    .then(() => console.log('MongoDB connected'))
    .catch((e) => console.error('MongoDB connection failed:', e.message));
}
app.listen(PORT, () => console.log(`Trading journal running on http://localhost:${PORT}`));
