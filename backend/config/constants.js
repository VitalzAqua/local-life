// Backend configuration constants

// Server configuration
const SERVER_CONFIG = {
  PORT: process.env.PORT || 3001,
  NODE_ENV: process.env.NODE_ENV || 'development',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
  /** Base URL for driver-assignment-service (no trailing slash). */
  DRIVER_ASSIGNMENT_SERVICE_URL:
    process.env.DRIVER_ASSIGNMENT_SERVICE_URL || 'http://localhost:3002'
};

// Database configuration
const DB_CONFIG = {
  CONNECTION_STRING: process.env.DATABASE_URL,
  POOL_SIZE: parseInt(process.env.DB_POOL_SIZE) || 10,
  IDLE_TIMEOUT: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
  CONNECTION_TIMEOUT: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 60000, // Increased to 60 seconds
  SSL: (() => {
    const url = process.env.DATABASE_URL || '';
    if (url.includes('localhost') || url.includes('127.0.0.1')) return false;
    return { rejectUnauthorized: false };
  })(),
  // Additional connection settings for reliability
  query_timeout: 30000,
  statement_timeout: 30000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000
};

// Geographic boundaries for Toronto
const TORONTO_BOUNDS = {
  NORTH: 43.855,
  SOUTH: 43.585,
  WEST: -79.639,
  EAST: -79.115
};

// Business logic constants
const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  ASSIGNED: 'assigned',
  READY: 'ready',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  EAT_IN: 'eat_in'
};

const RESERVATION_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

// Canonical delivery statuses — must stay in sync with routes/delivery.js
const DELIVERY_STATUS = {
  ASSIGNED: 'assigned',
  STARTED: 'started',
  ARRIVED_AT_RESTAURANT: 'arrived_at_restaurant',
  PICKED_UP: 'picked_up',
  RETURNING: 'returning',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

// Security constants
const SECURITY = {
  BCRYPT_ROUNDS: 12,
  MAX_LOGIN_ATTEMPTS: 5,
  LOGIN_TIMEOUT: 15 * 60 * 1000, // 15 minutes
  ADMIN_CODE: process.env.ADMIN_CODE
};

// API limits and pagination
const API_LIMITS = {
  SEARCH_RESULTS: 50,
  MAX_QUERY_LENGTH: 100,
  MAX_ITEMS_PER_ORDER: 20,
  MAX_PARTY_SIZE: 20
};

// Validation patterns
const VALIDATION = {
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE_REGEX: /^\+?[\d\s\-\(\)]+$/,
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 50,
  PASSWORD_MIN_LENGTH: 6,
  NOTES_MAX_LENGTH: 500
};

// Error messages
const ERROR_MESSAGES = {
  // Authentication
  INVALID_CREDENTIALS: 'Invalid email or password',
  USER_EXISTS: 'User with this email already exists',
  USER_NOT_FOUND: 'User not found',
  UNAUTHORIZED: 'Authentication required',
  
  // Validation
  INVALID_EMAIL: 'Please provide a valid email address',
  INVALID_PASSWORD: 'Password must be at least 6 characters long',
  INVALID_NAME: 'Name must be between 2 and 50 characters',
  REQUIRED_FIELDS: 'Please fill in all required fields',
  
  // Business logic
  STORE_CLOSED: 'Store is currently closed',
  STORE_NOT_FOUND: 'Store not found',
  ORDER_EMPTY: 'Order must contain at least one item',
  INVALID_PARTY_SIZE: 'Invalid party size',
  PAST_RESERVATION: 'Reservation must be in the future',
  
  // Generic
  SERVER_ERROR: 'Internal server error',
  NOT_FOUND: 'Resource not found',
  BAD_REQUEST: 'Invalid request data'
};

// Success messages
const SUCCESS_MESSAGES = {
  USER_CREATED: 'Account created successfully',
  LOGIN_SUCCESS: 'Login successful',
  ORDER_CREATED: 'Order placed successfully',
  RESERVATION_CREATED: 'Reservation booked successfully',
  STATUS_UPDATED: 'Status updated successfully'
};

// Time formats
const TIME_FORMATS = {
  STORE_HOURS: 'HH:mm',
  RESERVATION_DATETIME: 'YYYY-MM-DD HH:mm:ss',
  API_TIMESTAMP: 'YYYY-MM-DDTHH:mm:ss.SSSZ'
};

// Default values
const DEFAULTS = {
  PARTY_SIZE: 1,
  ORDER_STATUS: ORDER_STATUS.PENDING,
  RESERVATION_STATUS: RESERVATION_STATUS.PENDING,
  PAGINATION_LIMIT: 20,
  MAP_ZOOM: 13
}; 

// Export all constants
module.exports = {
  SERVER_CONFIG,
  DB_CONFIG,
  TORONTO_BOUNDS,
  ORDER_STATUS,
  RESERVATION_STATUS,
  DELIVERY_STATUS,
  SECURITY,
  API_LIMITS,
  VALIDATION,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  TIME_FORMATS,
  DEFAULTS
};