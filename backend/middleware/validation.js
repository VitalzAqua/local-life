const { VALIDATION, ERROR_MESSAGES, API_LIMITS } = require('../config/constants');

// Validation helper functions
const validateEmail = (email) => {
  return typeof email === 'string' && VALIDATION.EMAIL_REGEX.test(email.trim());
};

const validatePassword = (password) => {
  return typeof password === 'string' && password.length >= VALIDATION.PASSWORD_MIN_LENGTH;
};

const validateName = (name) => {
  return typeof name === 'string' && 
         name.trim().length >= VALIDATION.NAME_MIN_LENGTH && 
         name.trim().length <= VALIDATION.NAME_MAX_LENGTH;
};

const validateRequired = (fields, body) => {
  const missing = fields.filter(field => !body[field] || (typeof body[field] === 'string' && !body[field].trim()));
  return missing.length === 0 ? null : missing;
};

const sanitizeString = (str, maxLength = 255) => {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLength);
};

const validatePositiveInteger = (value, min = 1, max = Number.MAX_SAFE_INTEGER) => {
  const num = parseInt(value, 10);
  return !isNaN(num) && num >= min && num <= max;
};

const validatePositiveNumber = (value, min = 0) => {
  const num = parseFloat(value);
  return !isNaN(num) && num >= min;
};

// Middleware functions
const validateUserRegistration = (req, res, next) => {
  const { email, password, name } = req.body;
  
  // Check required fields
  const missing = validateRequired(['email', 'password', 'name'], req.body);
  if (missing) {
    return res.status(400).json({ 
      error: ERROR_MESSAGES.REQUIRED_FIELDS,
      missing_fields: missing
    });
  }
  
  // Validate email
  if (!validateEmail(email)) {
    return res.status(400).json({ error: ERROR_MESSAGES.INVALID_EMAIL });
  }
  
  // Validate password
  if (!validatePassword(password)) {
    return res.status(400).json({ error: ERROR_MESSAGES.INVALID_PASSWORD });
  }
  
  // Validate name
  if (!validateName(name)) {
    return res.status(400).json({ error: ERROR_MESSAGES.INVALID_NAME });
  }
  
  // Sanitize inputs
  req.body.email = sanitizeString(email).toLowerCase();
  req.body.name = sanitizeString(name);
  
  next();
};

const validateUserLogin = (req, res, next) => {
  const { email, password } = req.body;
  
  // Check required fields
  const missing = validateRequired(['email', 'password'], req.body);
  if (missing) {
    return res.status(400).json({ 
      error: ERROR_MESSAGES.REQUIRED_FIELDS,
      missing_fields: missing
    });
  }
  
  // Validate email format
  if (!validateEmail(email)) {
    return res.status(400).json({ error: ERROR_MESSAGES.INVALID_EMAIL });
  }
  
  // Sanitize email
  req.body.email = sanitizeString(email).toLowerCase();
  
  next();
};

const validateOrderCreation = (req, res, next) => {
  const { user_id, store_id, items, total_amount } = req.body;
  
  // Check required fields
  const missing = validateRequired(['user_id', 'store_id', 'items', 'total_amount'], req.body);
  if (missing) {
    return res.status(400).json({ 
      error: ERROR_MESSAGES.REQUIRED_FIELDS,
      missing_fields: missing
    });
  }
  
  // Validate user_id and store_id
  if (!validatePositiveInteger(user_id)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  
  if (!validatePositiveInteger(store_id)) {
    return res.status(400).json({ error: 'Invalid store ID' });
  }
  
  // Validate items array
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: ERROR_MESSAGES.ORDER_EMPTY });
  }
  
  if (items.length > API_LIMITS.MAX_ITEMS_PER_ORDER) {
    return res.status(400).json({ error: `Maximum ${API_LIMITS.MAX_ITEMS_PER_ORDER} items per order` });
  }
  
  // Validate each item
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    if (!item.name || typeof item.name !== 'string' || !item.name.trim()) {
      return res.status(400).json({ error: `Item ${i + 1}: name is required` });
    }
    
    if (!validatePositiveInteger(item.quantity, 1, 99)) {
      return res.status(400).json({ error: `Item ${i + 1}: invalid quantity` });
    }
    
    if (!validatePositiveNumber(item.price, 0.01)) {
      return res.status(400).json({ error: `Item ${i + 1}: invalid price` });
    }
    
    // Sanitize item data
    items[i].name = sanitizeString(item.name);
    items[i].notes = sanitizeString(item.notes || '', VALIDATION.NOTES_MAX_LENGTH);
  }
  
  // Validate total amount
  if (!validatePositiveNumber(total_amount, 0.01)) {
    return res.status(400).json({ error: 'Invalid total amount' });
  }
  
  next();
};

const validateReservationCreation = (req, res, next) => {
  const { user_id, store_id, reservation_date, party_size } = req.body;
  
  // Check required fields
  const missing = validateRequired(['user_id', 'store_id', 'reservation_date', 'party_size'], req.body);
  if (missing) {
    return res.status(400).json({ 
      error: ERROR_MESSAGES.REQUIRED_FIELDS,
      missing_fields: missing
    });
  }
  
  // Validate user_id and store_id
  if (!validatePositiveInteger(user_id)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  
  if (!validatePositiveInteger(store_id)) {
    return res.status(400).json({ error: 'Invalid store ID' });
  }
  
  // Validate party size
  if (!validatePositiveInteger(party_size, 1, API_LIMITS.MAX_PARTY_SIZE)) {
    return res.status(400).json({ error: ERROR_MESSAGES.INVALID_PARTY_SIZE });
  }
  
  // Validate reservation date
  const reservationDateTime = new Date(reservation_date);
  if (isNaN(reservationDateTime.getTime())) {
    return res.status(400).json({ error: 'Invalid reservation date format' });
  }
  
  if (reservationDateTime <= new Date()) {
    return res.status(400).json({ error: ERROR_MESSAGES.PAST_RESERVATION });
  }
  
  // Sanitize notes if provided
  if (req.body.notes) {
    req.body.notes = sanitizeString(req.body.notes, VALIDATION.NOTES_MAX_LENGTH);
  }
  
  next();
};

const validateStatusUpdate = (req, res, next) => {
  const { status } = req.body;
  
  if (!status || typeof status !== 'string') {
    return res.status(400).json({ error: 'Status is required' });
  }
  
  // Validate status value (will be checked against specific enums in route handlers)
  req.body.status = sanitizeString(status).toLowerCase();
  
  next();
};

const validateSearchQuery = (req, res, next) => {
  const { q: query } = req.query;
  
  if (query && query.length > API_LIMITS.MAX_QUERY_LENGTH) {
    return res.status(400).json({ error: `Search query too long (max ${API_LIMITS.MAX_QUERY_LENGTH} characters)` });
  }
  
  next();
};

const validatePagination = (req, res, next) => {
  const { page, limit } = req.query;
  
  if (page && !validatePositiveInteger(page, 1)) {
    return res.status(400).json({ error: 'Invalid page number' });
  }
  
  if (limit && !validatePositiveInteger(limit, 1, 100)) {
    return res.status(400).json({ error: 'Invalid limit (1-100)' });
  }
  
  next();
};

module.exports = {
  validateUserRegistration,
  validateUserLogin,
  validateOrderCreation,
  validateReservationCreation,
  validateStatusUpdate,
  validateSearchQuery,
  validatePagination,
  // Export helper functions for use in other modules
  validateEmail,
  validatePassword,
  validateName,
  validateRequired,
  sanitizeString,
  validatePositiveInteger,
  validatePositiveNumber
}; 