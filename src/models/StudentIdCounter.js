import mongoose from 'mongoose';

const studentIdCounterSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    sequence: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    versionKey: false,
  }
);

export default mongoose.model('StudentIdCounter', studentIdCounterSchema);