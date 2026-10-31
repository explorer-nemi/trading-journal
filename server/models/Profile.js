import mongoose from 'mongoose';

const profileSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'me', unique: true },
    displayName: { type: String, default: 'Trader' },
    broker: { type: String, default: '' },
    startingCapital: { type: Number, default: 0 },
    // Your rules, editable on the Profile page
    maxLoss: { type: Number, default: 120 }, // rule 1
    targetMin: { type: Number, default: 350 }, // rule 2
    targetMax: { type: Number, default: 400 }, // rule 2
    maxLossTrades: { type: Number, default: 2 }, // rule 5: stop the day at this many losing trades
    expiryNearDays: { type: Number, default: 1 }, // rule 4: expiry this close -> use next expiry
  },
  { timestamps: true }
);

export default mongoose.model('Profile', profileSchema);
