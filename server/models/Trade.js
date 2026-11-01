import mongoose from 'mongoose';

const tradeSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, index: true }, // YYYY-MM-DD, India time
    session: { type: String, enum: ['day', 'afternoon'], default: 'day' },
    segment: { type: String, enum: ['equity', 'fno'], required: true },
    underlying: { type: String, enum: ['NIFTY', 'SENSEX', ''], default: '' },
    optionType: { type: String, enum: ['CE', 'PE', 'FUT', ''], default: '' },
    strike: Number,
    expiry: String,
    symbol: { type: String, required: true, trim: true, uppercase: true },
    direction: { type: String, enum: ['long', 'short'], default: 'long' },
    qty: { type: Number, required: true, min: 1 },
    entryPrice: { type: Number, required: true },
    exitPrice: { type: Number, required: true },
    stopLoss: Number,
    target: Number,
    fees: { type: Number, default: 0 },
    grossPnl: Number, // before fees and tax
    netPnl: Number, // after fees
    strategy: String,
    outcome: String,
    analysis: String,
    // One tick per rule. The three/four without defaults are new: older trades fall back to auto-checks in the app.
    checks: {
      slPlaced: Boolean, // rule 7
      lossOk: Boolean, // rule 1
      confirm5m: { type: Boolean, default: false }, // rule 3
      srLevel: { type: Boolean, default: false }, // rule 3
      expiryOk: { type: Boolean, default: false }, // rule 4
      noOvertrade: Boolean, // rule 5
      noGreed: { type: Boolean, default: false }, // rule 6
      targetOk: Boolean, // rule 2
    },
    psychology: {
      confidence: { type: Number, default: 5, min: 1, max: 10 },
      satisfaction: { type: Number, default: 5, min: 1, max: 10 },
      emotion: String,
      mistakes: [String],
      lessons: String,
    },
    // Chart screenshots (compressed in the browser). Hidden from list queries to keep them fast.
    screenshots: { type: [String], select: false },
    shotCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model('Trade', tradeSchema);
