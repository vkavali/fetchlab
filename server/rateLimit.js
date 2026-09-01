import rateLimit from 'express-rate-limit';
import { verifyToken } from './auth.js';

function tokenSubject(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ')
    ? auth.slice(7)
    : req.cookies?.fl_session;
  if (!token) return null;
  try {
    return verifyToken(token)?.sub || null;
  } catch {
    return null;
  }
}

const userKey = (req) => req.gateToken?.id || req.user?.id || tokenSubject(req) || req.ip;
const isDisabled = () => process.env.RATE_LIMIT_DISABLED === '1' || process.env.NODE_ENV === 'test';

const passthrough = (_req, _res, next) => next();

export const authLimiter = isDisabled() ? passthrough : rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts. Try again in a minute.' },
});

export const aiLimiter = isDisabled() ? passthrough : rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKey,
  message: { error: 'AI rate limit exceeded (20/min). Slow down.' },
});

export const apiLimiter = isDisabled() ? passthrough : rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKey,
  message: { error: 'API rate limit exceeded (100/min).' },
});

export const gateCredentialLimiter = isDisabled() ? passthrough : rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authority credential attempts. Try again in a minute.' },
});
