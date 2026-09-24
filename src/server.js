import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import authRoutes from './routes/authRoutes.js';
import batchRoutes from './routes/batchRoutes.js';
import studentRoutes from './routes/studentRoutes.js';
import certificateRoutes from './routes/certificateRoutes.js';

dotenv.config();

mongoose.set('bufferCommands', false);

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

let mongoConnectionPromise = null;

const connectToDatabase = async () => {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is required. Add your MongoDB Atlas connection string to backend/.env or Vercel environment variables.');
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!mongoConnectionPromise) {
    mongoConnectionPromise = mongoose.connect(MONGODB_URI, {
      dbName: 'nexora',
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
    }).then(() => {
      console.log('MongoDB connected successfully');
      return mongoose.connection;
    }).catch((error) => {
      mongoConnectionPromise = null;
      throw error;
    });
  }

  return mongoConnectionPromise;
};

const ensureDatabaseReady = async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (error) {
    console.error('Database readiness check failed:', error.message);
    return res.status(503).json({
      message: 'Database is unavailable. Please try again in a moment.',
      error: error.message,
    });
  }
};

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

app.get('/', (req, res) => {
  res.json({ ok: true, message: 'Nexora backend is running' });
});

app.get('/api/health', async (req, res) => {
  try {
    await connectToDatabase();
    res.json({
      ok: true,
      message: 'Nexora backend is running',
      dbConnected: mongoose.connection.readyState === 1,
    });
  } catch (error) {
    res.status(503).json({
      ok: false,
      message: 'Database connection failed',
      error: error.message,
    });
  }
});

app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

app.use('/api/auth', authRoutes);
app.use('/api/batches', ensureDatabaseReady, batchRoutes);
app.use('/api/students', ensureDatabaseReady, studentRoutes);
app.use('/api/certificates', ensureDatabaseReady, certificateRoutes);

const startServer = async () => {
  try {
    await connectToDatabase();
    app.listen(PORT, () => {
      console.log(`Nexora backend running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

if (process.env.VERCEL !== '1' && process.env.NODE_ENV !== 'production') {
  startServer();
} else {
  connectToDatabase().catch((error) => {
    console.error('MongoDB connection failed:', error.message);
  });
}

export default app;
