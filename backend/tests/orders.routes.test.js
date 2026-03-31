jest.mock('../db', () => ({
  db: {
    query: jest.fn()
  }
}));

const { db } = require('../db');
const { issueUserToken } = require('../utils/authTokens');
const { executeRoute } = require('./helpers/executeRoute');
const ordersRouter = require('../routes/orders');

describe('order creation validation', () => {
  beforeEach(() => {
    db.query.mockReset();
  });

  test('rejects order creation when the items array is empty', async () => {
    const token = issueUserToken({ id: 12, email: 'buyer@example.com', name: 'Buyer' });

    const response = await executeRoute(ordersRouter, {
      method: 'POST',
      url: '/',
      headers: {
        authorization: `Bearer ${token}`
      },
      body: {
        store_id: 5,
        items: [],
        total_amount: 22.5,
        order_type: 'eat_in'
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response._getJSONData()).toEqual({ error: 'Order must contain at least one item' });
    expect(db.query).not.toHaveBeenCalled();
  });
});
