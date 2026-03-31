const { verifyToken } = require('../utils/authTokens');

function getBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
}

function attachAuth(req, res, next) {
  const token = getBearerToken(req);

  if (!token) {
    req.auth = null;
    return next();
  }

  try {
    req.auth = verifyToken(token);
    return next();
  } catch (_error) {
    req.auth = null;
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    const token = getBearerToken(req);

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const payload = verifyToken(token);
      req.auth = payload;

      if (payload.role !== role) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      return next();
    } catch (_error) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}

function requireAuth(req, res, next) {
  const token = getBearerToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    req.auth = verifyToken(token);
    return next();
  } catch (_error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

const requireUser = requireRole('user');

const requireAdmin = requireRole('admin');

function requireSameUserOrAdmin(paramName = 'userId') {
  return (req, res, next) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.auth.role === 'admin') {
      return next();
    }

    const requestedUserId = Number.parseInt(req.params[paramName], 10);
    if (!Number.isInteger(requestedUserId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    if (requestedUserId !== Number(req.auth.sub)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    return next();
  };
}

module.exports = {
  attachAuth,
  requireAdmin,
  requireAuth,
  requireSameUserOrAdmin,
  requireUser
};
