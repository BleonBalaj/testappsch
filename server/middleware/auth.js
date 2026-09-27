import { auth } from '../firebaseAdmin.js';

export async function verifyFirebaseToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const idToken = authHeader.split('Bearer ')[1].trim();
  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (err) {
    console.error('verifyFirebaseToken failed:', err.message);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token', details: err.code });
  }
}

// In-memory rate limiter helper
const rateLimitMap = new Map();

export function rateLimit({ windowMs = 60 * 1000, max = 15 } = {}) {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const clientRecord = rateLimitMap.get(ip) || { count: 0, resetTime: now + windowMs };

    if (now > clientRecord.resetTime) {
      clientRecord.count = 1;
      clientRecord.resetTime = now + windowMs;
    } else {
      clientRecord.count += 1;
    }

    rateLimitMap.set(ip, clientRecord);

    if (clientRecord.count > max) {
      return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
    }

    next();
  };
}
