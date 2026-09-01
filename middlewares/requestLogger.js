const crypto = require('crypto');
const { formatLapaz } = require('../utils/dateUtils');

// Minimal, efficient request logger and lightweight dedupe helper info
// - Uses built-in crypto.randomUUID() for request IDs (no extra dependency)
// - Computes sha256 of the body for quick equality checks
// - Sets X-Request-Id header and logs short info to console

module.exports = (req, res, next) => {
  try {
    const requestId = (crypto.randomUUID && crypto.randomUUID()) || crypto.randomBytes(16).toString('hex');
    req.requestId = requestId;

    const bodyString = req.body && Object.keys(req.body).length ? JSON.stringify(req.body) : '';
    const bodyHash = crypto.createHash('sha256').update(bodyString).digest('hex');
    req.bodyHash = bodyHash;

    // Minimal info (timestamp, id, method, path, ip, bodyHash)
    const now = formatLapaz(new Date(), "dd/MM/yyyy HH:mm:ss");
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress;

    // Keep logs concise; can be expanded to structured logger later
    console.log(`[${now}] [req:${requestId}] ${req.method} ${req.originalUrl} ip=${ip} bodyHash=${bodyHash}`);

    // Expose request id and hash to response headers for easier tracing
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Body-Hash', bodyHash);

    next();
  } catch (err) {
    // Never break request flow if logging fails
    console.error('requestLogger error:', err);
    next();
  }
};
