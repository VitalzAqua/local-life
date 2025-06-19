const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const { SERVER_CONFIG, DB_CONFIG, TORONTO_BOUNDS, API_LIMITS } = require('./config/constants');
const { validateSearchQuery } = require('./middleware/validation');

const app = express();

// CORS configuration
app.use(cors({
  origin: SERVER_CONFIG.CORS_ORIGIN,
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Import routes
const usersRouter = require('./routes/users');
const ordersRouter = require('./routes/orders');
const reservationsRouter = require('./routes/reservations');
const nearbyRouter = require('./routes/nearby');
const deliveryRouter = require('./routes/delivery');

// Database connection with improved configuration
const pool = new Pool({
  connectionString: DB_CONFIG.CONNECTION_STRING,
  max: DB_CONFIG.POOL_SIZE,
  idleTimeoutMillis: DB_CONFIG.IDLE_TIMEOUT,
  connectionTimeoutMillis: DB_CONFIG.CONNECTION_TIMEOUT,
});

// Enhanced database interface
const db = {
  query: (...args) => pool.query(...args),
  getClient: () => pool.connect(),
  end: () => pool.end()
};

// Make database available globally (consider using dependency injection instead)
global.db = db;

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await db.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await db.end();
  process.exit(0);
});

// Mount routes
app.use('/api/users', usersRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/reservations', reservationsRouter);
app.use('/api/nearby', nearbyRouter);
app.use('/api/delivery', deliveryRouter);

// Health check endpoint for deployment services
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Search by name, category, or products within Toronto boundaries
app.get('/api/search', validateSearchQuery, async (req, res) => {
  const query = req.query.q || '';
  const { categories } = req.query;
  
  if (!query.trim()) {
    return res.json([]);
  }
  
  // Split query into terms for better matching
  const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
  
  // Build category filter
  let categoryFilter = '';
  let queryParams = [
    TORONTO_BOUNDS.SOUTH,
    TORONTO_BOUNDS.NORTH,
    TORONTO_BOUNDS.WEST,
    TORONTO_BOUNDS.EAST
  ];
  
  if (categories && categories.length > 0) {
    const categoryArray = categories.split(',');
    categoryFilter = ` AND category = ANY($${queryParams.length + 1})`;
    queryParams.push(categoryArray);
  }
  
  // Build search conditions for each term
  const searchConditions = searchTerms.map((term, index) => {
    const paramIndex = queryParams.length + 1;
    queryParams.push(`%${term}%`);
    
    return `(
      name ILIKE $${paramIndex}
      OR category ILIKE $${paramIndex}
      OR (attributes->>'address') ILIKE $${paramIndex}
      OR (attributes->>'phone') ILIKE $${paramIndex}
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(attributes->'products') AS prod
        WHERE prod ILIKE $${paramIndex}
      )
    )`;
  });
  
  // All search terms must match (AND logic)
  const searchClause = searchConditions.join(' AND ');
  
  const sql = `
    SELECT id, name, category,
           ST_Y(location::geometry) AS lat,
           ST_X(location::geometry) AS lng,
           attributes,
           -- Calculate relevance score for ranking
           (
             CASE WHEN name ILIKE $${queryParams.length + 1} THEN 100 ELSE 0 END +
             CASE WHEN (attributes->>'address') ILIKE $${queryParams.length + 1} THEN 50 ELSE 0 END +
             CASE WHEN category ILIKE $${queryParams.length + 1} THEN 30 ELSE 0 END
           ) AS relevance_score
    FROM stores
    WHERE (${searchClause})
    AND ST_Y(location::geometry) BETWEEN $1 AND $2
    AND ST_X(location::geometry) BETWEEN $3 AND $4${categoryFilter}
    ORDER BY relevance_score DESC, name
    LIMIT ${API_LIMITS.SEARCH_RESULTS};
  `;
  
  // Add the full query for relevance scoring
  queryParams.push(`%${query}%`);
  
  try {
    const result = await pool.query(sql, queryParams);
    res.json(result.rows);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Start server
const server = app.listen(SERVER_CONFIG.PORT, () => {
  console.log(`🚀 Server running on port ${SERVER_CONFIG.PORT}`);
  console.log(`📍 Environment: ${SERVER_CONFIG.NODE_ENV}`);
  console.log(`🌐 CORS origin: ${SERVER_CONFIG.CORS_ORIGIN}`);
});

// Handle server errors
server.on('error', (error) => {
  console.error('Server error:', error);
});

module.exports = app;