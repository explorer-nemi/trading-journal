import mongoose from 'mongoose';

const daySchema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true }, // YYYY-MM-DD
    noTrade: { type: Boolean, default: false },
    note: { type: String, default: '' }, // notes for the day
    todos: [{ text: { type: String, required: true }, done: { type: Boolean, default: false } }], // daily to-do list
  },
  { timestamps: true }
);

export default mongoose.model('Day', daySchema);
