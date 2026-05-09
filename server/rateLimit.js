import rateLimit from 'express-rate-limit';

const userKey = (req) => (req.user && req.user.id) || req.ip;
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
