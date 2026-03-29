const { Pool } = require('pg');
const { DB_CONFIG } = require('./config/constants');

const pool = new Pool({
  connectionString: DB_CONFIG.CONNECTION_STRING,
  max: DB_CONFIG.POOL_SIZE,
  idleTimeoutMillis: DB_CONFIG.IDLE_TIMEOUT,
  connectionTimeoutMillis: DB_CONFIG.CONNECTION_TIMEOUT,
  query_timeout: DB_CONFIG.query_timeout,
  statement_timeout: DB_CONFIG.statement_timeout,
  keepAlive: DB_CONFIG.keepAlive,
  keepAliveInitialDelayMillis: DB_CONFIG.keepAliveInitialDelayMillis,
  ssl: DB_CONFIG.SSL
});

pool.on('connect', () => {
  console.log('✅ Database client connected');
});

pool.on('error', (err) => {
  console.error('❌ Database connection error:', err);
});

// Convenience wrapper matching the interface used throughout the app
const db = {
  query: (...args) => pool.query(...args),
  getClient: () => pool.connect(),
  end: () => pool.end()
};

module.exports = { pool, db };
