import express from 'express';
import Batch from '../models/Batch.js';
import Student from '../models/Student.js';
import Certificate from '../models/Certificate.js';
import { verifyToken } from '../utils/auth.js';

const router = express.Router();

const serializeBatch = (batch) => ({
  ...batch.toObject(),
  id: batch._id.toString(),
});

const serializeStudent = (student) => ({
  ...student.toObject(),
  id: student._id.toString(),
});

const serializeCertificate = (certificate) => ({
  ...certificate.toObject(),
  id: certificate._id.toString(),
});

router.use(verifyToken);

router.get('/', async (req, res) => {
  try {
    const batches = await Batch.find().sort({ createdAt: -1 });
    return res.json({ batches: batches.map(serializeBatch) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch batches', error: error.message });
  }
});

router.post('/', async (req, res) => {
  const { name, enrollmentDate } = req.body || {};

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Batch name is required' });
  }

  const normalizedName = name.trim();

  try {
    const exists = await Batch.findOne({
      name: { $regex: `^${normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    });

    if (exists) {
      return res.status(400).json({ message: 'Batch already exists' });
    }

    const newBatch = await Batch.create({
      name: normalizedName,
      enrollmentDate: enrollmentDate ? new Date(enrollmentDate) : null,
    });

    return res.status(201).json({ message: 'Batch created', batch: serializeBatch(newBatch) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create batch', error: error.message });
  }
});

router.get('/:batchId', async (req, res) => {
  const { batchId } = req.params;

  try {
    const batch = await Batch.findById(batchId);

    if (!batch) {
      return res.status(404).json({ message: 'Batch not found' });
    }

    return res.json({ batch: serializeBatch(batch) });
  } catch (error) {
    return res.status(400).json({ message: 'Invalid batch id' });
  }
});

router.delete('/:batchId', async (req, res) => {
  const { batchId } = req.params;

  try {
    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({ message: 'Batch not found' });
    }

    const students = await Student.find({ batch: batch._id });
    const studentIds = students.map((student) => student._id);

    await Certificate.deleteMany({ batch: batch._id });
    await Certificate.deleteMany({ studentId: { $in: studentIds } });
    await Student.deleteMany({ batch: batch._id });
    await Batch.findByIdAndDelete(batch._id);

    return res.json({
      message: 'Batch and all associated students and certificates were permanently deleted.',
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete batch', error: error.message });
  }
});

export default router;
