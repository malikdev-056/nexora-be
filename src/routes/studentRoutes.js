import express from 'express';
import Batch from '../models/Batch.js';
import Student from '../models/Student.js';
import Certificate from '../models/Certificate.js';
import { verifyToken } from '../utils/auth.js';

const router = express.Router();

const generateStudentId = (batchName, sequenceNumber) => {
  const match = String(batchName || '').match(/\d+/);
  const batchPrefix = match ? `b${match[0]}` : `b${String(batchName || '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 3) || 'batch'}`;
  return `${batchPrefix}std${String(sequenceNumber).padStart(3, '0')}`;
};

const serializeStudent = (student) => ({
  ...student.toObject(),
  id: student._id.toString(),
  studentId: student.studentId,
});

router.use(verifyToken);

router.get('/:batchId', async (req, res) => {
  const { batchId } = req.params;

  try {
    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({ message: 'Batch not found' });
    }

    const students = await Student.find({ batch: batch._id }).sort({ createdAt: -1 });
    return res.json({ students: students.map(serializeStudent) });
  } catch (error) {
    return res.status(400).json({ message: 'Invalid batch id' });
  }
});

router.post('/:batchId', async (req, res) => {
  const { batchId } = req.params;
  const { name, email, phone, course, courses, status = 'active' } = req.body || {};

  const normalizedCourses = Array.isArray(courses)
    ? courses.filter(Boolean).map((item) => String(item).trim())
    : [];

  const primaryCourse = (course || normalizedCourses[0] || '').trim();

  if (!name || !email || (!primaryCourse && normalizedCourses.length === 0)) {
    return res.status(400).json({ message: 'Name, email and at least one course are required' });
  }

  try {
    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({ message: 'Batch not found' });
    }

    const existingStudentCount = await Student.countDocuments({ batch: batch._id });
    const studentId = generateStudentId(batch.name, existingStudentCount + 1);

    const student = await Student.create({
      batch: batch._id,
      studentId,
      name: name.trim(),
      email: email.trim(),
      phone: phone ? phone.trim() : '',
      course: primaryCourse,
      courses: normalizedCourses.length > 0 ? normalizedCourses : (primaryCourse ? [primaryCourse] : []),
      status,
    });

    return res.status(201).json({ message: 'Student added successfully', student: serializeStudent(student) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to add student', error: error.message });
  }
});

router.put('/:batchId/:studentId', async (req, res) => {
  const { batchId, studentId } = req.params;

  try {
    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({ message: 'Batch not found' });
    }

    const student = await Student.findOne({ _id: studentId, batch: batch._id });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const updateData = { ...req.body };
    delete updateData.id;
    delete updateData._id;

    Object.assign(student, updateData);
    await student.save();

    return res.json({ message: 'Student updated', student: serializeStudent(student) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update student', error: error.message });
  }
});

router.delete('/:batchId/:studentId', async (req, res) => {
  const { batchId, studentId } = req.params;

  try {
    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({ message: 'Batch not found' });
    }

    const deletedStudent = await Student.findOne({ _id: studentId, batch: batch._id });
    if (!deletedStudent) {
      return res.status(404).json({ message: 'Student not found' });
    }

    await Certificate.deleteMany({
      $or: [
        { studentId: deletedStudent._id },
        { studentCode: deletedStudent.studentId },
      ],
    });

    await Student.findOneAndDelete({ _id: studentId, batch: batch._id });

    return res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete student', error: error.message });
  }
});

export default router;
