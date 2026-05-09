process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_DISABLED = '1';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-very-long-key-for-tests';
process.env.APP_ENCRYPTION_KEY = process.env.APP_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
