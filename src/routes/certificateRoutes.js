import express from 'express';
import multer from 'multer';
import Batch from '../models/Batch.js';
import Certificate from '../models/Certificate.js';
import { verifyToken } from '../utils/auth.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
      return;
    }

    cb(new Error('Only JPG, PNG, and WEBP images up to 5MB are allowed'));
  },
});

const serializeCertificate = (certificate) => {
  const baseUrl = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
  const certificateId = certificate._id.toString();
  const batchId = certificate.batch.toString();
  const fileUrl = `${baseUrl}/api/certificates/${batchId}/${certificateId}/download`;

  return {
    ...certificate.toObject(),
    id: certificateId,
    batchId,
    studentCode: certificate.studentCode,
    fileUrl,
    uploadedAt: certificate.createdAt ? certificate.createdAt.toISOString() : new Date().toISOString(),
  };
};

router.get('/lookup/:studentCode', async (req, res) => {
  const { studentCode } = req.params;

  try {
    const certificate = await Certificate.findOne({ studentCode: { $regex: `^${studentCode.trim()}$`, $options: 'i' } }).sort({ createdAt: -1 });

    if (!certificate) {
      return res.status(404).json({ message: 'Student ID is not registered or certificate not found.' });
    }

    return res.json({
      studentCode: certificate.studentCode,
      studentName: certificate.studentName,
      fileName: certificate.fileName,
      fileUrl: `${process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 5000}`}/api/certificates/download/${certificate.studentCode}`,
      uploadedAt: certificate.createdAt ? certificate.createdAt.toISOString() : new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to check certificate', error: error.message });
  }
});

router.get('/download/:studentCode', async (req, res) => {
  const { studentCode } = req.params;

  try {
    const certificate = await Certificate.findOne({ studentCode: { $regex: `^${studentCode.trim()}$`, $options: 'i' } });
    if (!certificate) {
      return res.status(404).json({ message: 'Certificate not found for this student ID' });
    }

    res.setHeader('Content-Type', certificate.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(certificate.fileName)}"`);
    return res.send(certificate.fileData);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to download certificate', error: error.message });
  }
});

router.use(verifyToken);

router.get('/:batchId', async (req, res) => {
  const { batchId } = req.params;

  try {
    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({ message: 'Batch not found' });
    }

    const certificates = await Certificate.find({ batch: batch._id }).sort({ createdAt: -1 });
    return res.json({ certificates: certificates.map(serializeCertificate) });
  } catch (error) {
    return res.status(400).json({ message: 'Invalid batch id' });
  }
});

router.post('/:batchId/upload', upload.single('file'), async (req, res) => {
  const { batchId } = req.params;
  const { studentId, studentName, studentCode } = req.body || {};

  if (!req.file) {
    return res.status(400).json({ message: 'Certificate image is required' });
  }

  if (!studentName || !studentName.trim()) {
    return res.status(400).json({ message: 'Student name is required' });
  }

  try {
    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({ message: 'Batch not found' });
    }

    const normalizedName = studentName.trim();
    const certificate = await Certificate.create({
      batch: batch._id,
      studentId: studentId || null,
      studentCode: studentCode || normalizedName,
      studentName: normalizedName,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      fileData: req.file.buffer,
      fileUrl: `${process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 5000}`}/api/certificates/download/${studentCode || normalizedName}`,
    });

    return res.status(201).json({
      message: 'Certificate uploaded',
      certificate: serializeCertificate(certificate),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to upload certificate', error: error.message });
  }
});

router.post('/:batchId', async (req, res) => {
  const { batchId } = req.params;
  const { studentId, studentName, fileName, fileUrl } = req.body || {};

  if (!studentName || !fileName || !fileUrl) {
    return res.status(400).json({ message: 'Student name, file name and file URL are required' });
  }

  try {
    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({ message: 'Batch not found' });
    }

    const certificate = await Certificate.create({
      batch: batch._id,
      studentId: studentId || null,
      studentName: studentName.trim(),
      fileName: fileName.trim(),
      mimeType: 'application/octet-stream',
      fileSize: 0,
      fileData: Buffer.from(''),
      fileUrl: fileUrl.trim(),
    });

    return res.status(201).json({
      message: 'Certificate uploaded',
      certificate: serializeCertificate(certificate),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to upload certificate', error: error.message });
  }
});

router.get('/:batchId/:certificateId/download', async (req, res) => {
  const { batchId, certificateId } = req.params;

  try {
    const certificate = await Certificate.findOne({ _id: certificateId, batch: batchId });
    if (!certificate) {
      return res.status(404).json({ message: 'Certificate not found' });
    }

    res.setHeader('Content-Type', certificate.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(certificate.fileName)}"`);
    return res.send(certificate.fileData);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to download certificate', error: error.message });
  }
});

router.delete('/:batchId/:certificateId', async (req, res) => {
  const { batchId, certificateId } = req.params;

  try {
    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({ message: 'Batch not found' });
    }

    const deletedCertificate = await Certificate.findOneAndDelete({ _id: certificateId, batch: batch._id });
    if (!deletedCertificate) {
      return res.status(404).json({ message: 'Certificate not found' });
    }

    return res.json({ message: 'Certificate deleted' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete certificate', error: error.message });
  }
});

export default router;
