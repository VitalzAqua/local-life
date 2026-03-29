const adminAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token || token !== process.env.ADMIN_CODE) {
    return res.status(401).json({ error: 'Admin access required' });
  }

  next();
};

module.exports = adminAuth;
