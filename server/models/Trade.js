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
    checks: {
      confirm5m: { type: Boolean, default: false },
      srLevel: { type: Boolean, default: false },
      expiryOk: { type: Boolean, default: false },
      noGreed: { type: Boolean, default: false },
    },
    psychology: {
      confidence: { type: Number, default: 5, min: 1, max: 10 },
      satisfaction: { type: Number, default: 5, min: 1, max: 10 },
      emotion: String,
      mistakes: [String],
      lessons: String,
    },
  },
  { timestamps: true }
);

export default mongoose.model('Trade', tradeSchema);
