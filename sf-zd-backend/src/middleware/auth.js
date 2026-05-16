/**
 * src/middleware/auth.js
 * Validates the shared secret sent by the ZAF sidebar.
 */
function requireAppSecret(req, res, next) {
  const secret = req.headers["x-app-secret"];
  if (!secret || secret !== process.env.APP_SECRET) {
    return res.status(401).json({ error: "Unauthorized: invalid or missing X-App-Secret" });
  }
  next();
}

module.exports = { requireAppSecret };
