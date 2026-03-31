jest.mock('../db', () => ({
  db: {
    query: jest.fn()
  }
}));

const { db } = require('../db');
const { issueUserToken, issueAdminToken } = require('../utils/authTokens');
const { executeRoute } = require('./helpers/executeRoute');
const savedLocationsRouter = require('../routes/savedLocations');

describe('saved locations ownership checks', () => {
  beforeEach(() => {
    db.query.mockReset();
  });

  test('rejects a user trying to read another user’s saved locations', async () => {
    const token = issueUserToken({ id: 1, email: 'one@example.com', name: 'User One' });

    const response = await executeRoute(savedLocationsRouter, {
      method: 'GET',
      url: '/user/2',
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response._getJSONData()).toEqual({ error: 'Forbidden' });
    expect(db.query).not.toHaveBeenCalled();
  });

  test('allows an admin token to pass the same ownership check', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const adminToken = issueAdminToken();

    const response = await executeRoute(savedLocationsRouter, {
      method: 'GET',
      url: '/user/2',
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response._getJSONData()).toEqual([]);
    expect(db.query).toHaveBeenCalledTimes(1);
  });
});
