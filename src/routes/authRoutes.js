import express from 'express';
import { generateToken } from '../utils/auth.js';

const router = express.Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@nexora.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  if (email.trim() === adminEmail && password === adminPassword) {
    const token = generateToken(email);
    return res.json({
      message: 'Login successful',
      token,
      admin: {
        email,
      },
    });
  }

  return res.status(401).json({ message: 'Invalid credentials' });
});

export default router;
