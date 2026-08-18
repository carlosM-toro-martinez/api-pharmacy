module.exports = (req, res, next) => {
  const originalEnd = res.end.bind(res);

  res.end = function (...args) {
    const id = req.requestId || 'no-id';
    const now = new Date().toISOString();

    if (res.writableEnded || res.finished || res.headersSent && res.writableFinished) {
      console.warn(`[${now}] [req:${id}] Duplicate response attempt for ${req.method} ${req.originalUrl}. Ignoring.`);
      return;
    }

    try {
      return originalEnd(...args);
    } catch (err) { 
      console.error(`[${now}] [req:${id}] Error calling res.end:`, err);

    }
  };

  next();
};
