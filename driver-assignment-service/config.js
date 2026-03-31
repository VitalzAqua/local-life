require('dotenv').config();

const config = {
  port: process.env.PORT || process.env.DRIVER_SERVICE_PORT || 3002,
  database: {
    connectionString: process.env.DATABASE_URL,
    pool: {
      max: parseInt(process.env.DB_POOL_SIZE) || 10,
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 60000,
    }
  },
  assignment: {
    maxDistance: parseFloat(process.env.MAX_ASSIGNMENT_DISTANCE) || 50, // km
    timeoutMs: parseInt(process.env.ASSIGNMENT_TIMEOUT) || 5000, // 5 seconds
    retries: parseInt(process.env.ASSIGNMENT_RETRIES) || 3
  },
  nodeEnv: process.env.NODE_ENV || 'development'
};

// Validate required configuration
if (!config.database.connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

module.exports = config; 
