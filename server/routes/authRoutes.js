import { Router } from 'express';
import { auth } from '../firebaseAdmin.js';
import { rateLimit } from '../middleware/auth.js';

const router = Router();

// Privacy-safe email existence check
// Zero metadata leaked: only returns boolean `exists`.
router.post('/check-email', rateLimit({ windowMs: 60 * 1000, max: 20 }), async (req, res) => {
  const { email } = req.body;
  
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Valid email string is required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  // Basic email pattern check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ error: 'Invalid email address format' });
  }

  try {
    const userRecord = await auth.getUserByEmail(normalizedEmail);
    // User found: do not disclose any details like uid, displayName, school, or creation time
    return res.json({ exists: true });
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      return res.json({ exists: false });
    }
    console.error('Error during check-email lookup:', error);
    return res.status(500).json({ error: 'Failed to verify email. Please try again.' });
  }
});

export default router;
