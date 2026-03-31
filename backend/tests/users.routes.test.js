const bcrypt = require('bcrypt');

jest.mock('../db', () => ({
  db: {
    query: jest.fn()
  }
}));

const { db } = require('../db');
const { verifyToken } = require('../utils/authTokens');
const { executeRoute } = require('./helpers/executeRoute');
const usersRouter = require('../routes/users');

describe('user auth routes', () => {
  beforeEach(() => {
    db.query.mockReset();
  });

  test('registers a user, sanitizes input, and returns a signed token', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 7, email: 'test@example.com', name: 'Ling' }]
    });

    const response = await executeRoute(usersRouter, {
      method: 'POST',
      url: '/register',
      body: {
        email: ' TEST@Example.com ',
        password: 'secret123',
        name: ' Ling '
      }
    });

    const body = response._getJSONData();

    expect(response.statusCode).toBe(201);
    expect(body.user).toEqual({
      id: 7,
      email: 'test@example.com',
      name: 'Ling'
    });
    expect(body.token).toEqual(expect.any(String));

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('INSERT INTO users');
    expect(params[0]).toBe('test@example.com');
    expect(params[1]).not.toBe('secret123');
    expect(params[2]).toBe('Ling');

    const payload = verifyToken(body.token);
    expect(payload.sub).toBe(7);
    expect(payload.role).toBe('user');
    expect(payload.email).toBe('test@example.com');
  });

  test('logs in an existing user and omits the password hash from the response', async () => {
    const passwordHash = await bcrypt.hash('secret123', 4);

    db.query.mockResolvedValueOnce({
      rows: [{
        id: 3,
        email: 'user@example.com',
        name: 'Local User',
        password_hash: passwordHash
      }]
    });

    const response = await executeRoute(usersRouter, {
      method: 'POST',
      url: '/login',
      body: {
        email: ' USER@example.com ',
        password: 'secret123'
      }
    });

    const body = response._getJSONData();

    expect(response.statusCode).toBe(200);
    expect(body.user).toEqual({
      id: 3,
      email: 'user@example.com',
      name: 'Local User'
    });
    expect(body.user.password_hash).toBeUndefined();
    expect(body.token).toEqual(expect.any(String));

    const payload = verifyToken(body.token);
    expect(payload.sub).toBe(3);
    expect(payload.role).toBe('user');
  });
});
