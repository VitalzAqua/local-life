const jwt = require('jsonwebtoken');

const DEV_FALLBACK_SECRET = 'local-life-dev-secret-change-me';

function getTokenSecret() {
  return process.env.JWT_SECRET || process.env.ADMIN_CODE || DEV_FALLBACK_SECRET;
}

function signToken(payload, options = {}) {
  return jwt.sign(payload, getTokenSecret(), {
    algorithm: 'HS256',
    expiresIn: options.expiresIn || '7d'
  });
}

function verifyToken(token) {
  return jwt.verify(token, getTokenSecret(), {
    algorithms: ['HS256']
  });
}

function issueUserToken(user) {
  return signToken(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: 'user'
    },
    { expiresIn: process.env.USER_TOKEN_TTL || '7d' }
  );
}

function issueAdminToken() {
  return signToken(
    {
      role: 'admin'
    },
    { expiresIn: process.env.ADMIN_TOKEN_TTL || '4h' }
  );
}

module.exports = {
  issueAdminToken,
  issueUserToken,
  signToken,
  verifyToken
};
