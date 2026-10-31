import mongoose from 'mongoose';

const daySchema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true }, // YYYY-MM-DD
    noTrade: { type: Boolean, default: false },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('Day', daySchema);
