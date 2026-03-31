process.env.JWT_SECRET = process.env.JWT_SECRET || 'local-life-test-secret';
process.env.ADMIN_CODE = process.env.ADMIN_CODE || 'local-life-test-admin';
process.env.USER_TOKEN_TTL = process.env.USER_TOKEN_TTL || '7d';
process.env.ADMIN_TOKEN_TTL = process.env.ADMIN_TOKEN_TTL || '4h';

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});
