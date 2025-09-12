const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const { SERVER_CONFIG, DB_CONFIG, TORONTO_BOUNDS, API_LIMITS } = require('./config/constants');
const { validateSearchQuery } = require('./middleware/validation');

const app = express();

// CORS configuration - Allow multiple localhost ports for development
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // Allow any localhost origin in development
    if (SERVER_CONFIG.NODE_ENV === 'development' && origin.includes('localhost')) {
      return callback(null, true);
    }
    
    // In production, use the specific CORS_ORIGIN
    if (origin === SERVER_CONFIG.CORS_ORIGIN) {
      return callback(null, true);
    }
    
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// Request timeout middleware - prevents hanging requests
app.use((req, res, next) => {
  // Set request timeout to 25 seconds
  req.setTimeout(25000, () => {
    console.log(`⏱️ Request timeout: ${req.method} ${req.url}`);
    if (!res.headersSent) {
      res.status(408).json({ 
        error: 'Request timeout',
        message: 'The request took too long to process'
      });
    }
  });
  next();
});

// Enhanced error handling middleware
app.use((req, res, next) => {
  res.on('timeout', () => {
    console.log(`⏱️ Response timeout: ${req.method} ${req.url}`);
  });
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Database connection with improved configuration - MUST be before route imports
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

// Test database connection on startup
pool.on('connect', () => {
  console.log('✅ Database client connected');
});

pool.on('error', (err) => {
  console.error('❌ Database connection error:', err);
});

// Enhanced database interface
const db = {
  query: (...args) => pool.query(...args),
  getClient: () => pool.connect(),
  end: () => pool.end()
};

// Make database available globally BEFORE importing routes
global.db = db;

// Import routes (after setting up global.db)
const usersRouter = require('./routes/users');
const ordersRouter = require('./routes/orders');
const reservationsRouter = require('./routes/reservations');
const nearbyRouter = require('./routes/nearby');
const deliveryRouter = require('./routes/delivery');
const savedLocationsRouter = require('./routes/savedLocations');

// Enhanced graceful shutdown with delivery cleanup
const gracefulShutdown = async (signal) => {
  console.log(`\n🔄 Received ${signal}. Starting graceful shutdown...`);
  
  try {
    // Step 1: Stop accepting new requests
    console.log('🚫 Stopping server from accepting new connections...');
    
    // Step 2: Clean up active deliveries
    console.log('🧹 Cleaning up active deliveries...');
    await cleanupActiveDeliveries();
    
    // Step 3: Reset all drivers to available state
    console.log('🚗 Resetting all drivers to available state...');
    await resetAllDrivers();
    
    // Step 4: Close database connections
    console.log('🗄️ Closing database connections...');
    await db.end();
    
    console.log('✅ Graceful shutdown completed successfully');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Function to clean up active deliveries
const cleanupActiveDeliveries = async () => {
  try {
    // Get all active deliveries
    const activeDeliveries = await db.query(`
      SELECT d.id, d.order_id, d.status, d.driver_id
      FROM deliveries d
      WHERE d.status IN ('assigned', 'en_route_to_restaurant', 'at_restaurant', 'picked_up', 'delivering')
    `);
    
    if (activeDeliveries.rows.length === 0) {
      console.log('  ℹ️ No active deliveries to clean up');
      return;
    }
    
    console.log(`  🧹 Found ${activeDeliveries.rows.length} active deliveries to clean up`);
    
    // Update all active deliveries to cancelled
    await db.query(`
      UPDATE deliveries 
      SET status = 'cancelled', 
          updated_at = CURRENT_TIMESTAMP
      WHERE status IN ('assigned', 'en_route_to_restaurant', 'at_restaurant', 'picked_up', 'delivering')
    `);
    
    // Update corresponding orders back to pending
    await db.query(`
      UPDATE orders 
      SET status = 'pending', 
          updated_at = CURRENT_TIMESTAMP
      WHERE id IN (
        SELECT order_id FROM deliveries 
        WHERE status = 'cancelled'
      )
    `);
    
    console.log(`  ✅ Cleaned up ${activeDeliveries.rows.length} active deliveries`);
    
  } catch (error) {
    console.error('  ❌ Error cleaning up active deliveries:', error);
    throw error;
  }
};

// Function to reset all drivers to available state
const resetAllDrivers = async () => {
  try {
    // Reset all drivers to available and move them back to original locations
    const result = await db.query(`
      UPDATE drivers 
      SET is_available = true, 
          is_online = true,
          current_lat = ST_Y(original_location),
          current_lng = ST_X(original_location),
          updated_at = CURRENT_TIMESTAMP
      WHERE is_available = false OR is_online = false
    `);
    
    console.log(`  ✅ Reset ${result.rowCount} drivers to available state`);
    
  } catch (error) {
    console.error('  ❌ Error resetting drivers:', error);
    throw error;
  }
};

// Enhanced startup recovery function
const startupRecovery = async () => {
  console.log('🔄 Running startup recovery...');
  
  try {
    // Test database connection first
    console.log('🔍 Testing database connection...');
    await testDatabaseConnection();
    
    // Clean up any stuck deliveries from previous session
    await cleanupActiveDeliveries();
    
    // Reset all drivers to available state
    await resetAllDrivers();
    
    console.log('✅ Startup recovery completed successfully');
    
  } catch (error) {
    console.error('❌ Error during startup recovery:', error);
    // Don't exit the process, just log the error
  }
};

// Function to test database connection
const testDatabaseConnection = async () => {
  try {
    const result = await db.query('SELECT NOW() as current_time, COUNT(*) as store_count FROM stores');
    console.log(`✅ Database connected successfully. Server time: ${result.rows[0].current_time}, Store count: ${result.rows[0].store_count}`);
    
    // Test categories query specifically
    const categoriesTest = await db.query('SELECT DISTINCT category FROM stores WHERE category IS NOT NULL ORDER BY category LIMIT 5');
    console.log(`✅ Categories query test passed. Sample categories: ${categoriesTest.rows.map(r => r.category).join(', ')}`);
    
  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    throw error;
  }
};

// Register graceful shutdown handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Run startup recovery when server starts
startupRecovery();

// Mount routes
app.use('/api/users', usersRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/reservations', reservationsRouter);
app.use('/api/nearby', nearbyRouter);
app.use('/delivery', deliveryRouter);
app.use('/api/saved-locations', savedLocationsRouter);

// Global error handler middleware
app.use((err, req, res, next) => {
  console.error(`❌ Global error handler: ${req.method} ${req.url}`, err);
  
  // If response already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(err);
  }
  
  // Handle specific error types
  if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
    return res.status(503).json({
      error: 'Database connection lost',
      message: 'Please try again in a moment'
    });
  }
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation error',
      message: err.message
    });
  }
  
  // Default error response
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'local-life-backend'
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'local-life-backend'
  });
});

// Search by name, category, or products within Toronto boundaries
app.get('/api/search', validateSearchQuery, async (req, res) => {
  const query = req.query.q || '';
  const { categories, limit } = req.query;
  
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
           attributes
    FROM stores
    WHERE (${searchClause})
    AND ST_Y(location::geometry) BETWEEN $1 AND $2
    AND ST_X(location::geometry) BETWEEN $3 AND $4${categoryFilter}
    ORDER BY name
    LIMIT ${Math.min(parseInt(limit) || API_LIMITS.SEARCH_RESULTS, API_LIMITS.SEARCH_RESULTS)}
  `;
  
  try {
    const result = await db.query(sql, queryParams);
    res.json(result.rows);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Debug endpoint to check stores in database
app.get('/api/debug/stores', async (req, res) => {
  try {
    const totalStores = await db.query('SELECT COUNT(*) FROM stores');
    const sampleStores = await db.query('SELECT id, name, category FROM stores LIMIT 5');
    
    res.json({
      total_stores: totalStores.rows[0].count,
      sample_stores: sampleStores.rows
    });
  } catch (err) {
    console.error('Debug stores error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Global search (no geographic restrictions) for all stores
app.get('/api/search/global', validateSearchQuery, async (req, res) => {
  const query = req.query.q || '';
  const { categories, limit } = req.query;
  
  if (!query.trim()) {
    // If no query, return all stores (for debugging)
    try {
      const result = await db.query(`
        SELECT id, name, category,
               ST_Y(location::geometry) AS lat,
               ST_X(location::geometry) AS lng,
               attributes
        FROM stores 
        ORDER BY name
        LIMIT 20
      `);
      
      const stores = result.rows.map(store => ({
        ...store,
        address: store.attributes?.address || 'Address not available',
        lat: parseFloat(store.lat),
        lng: parseFloat(store.lng)
      }));
      
      return res.json({ stores });
    } catch (err) {
      console.error('Error fetching all stores:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }
  
  // Split query into terms for better matching
  const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
  
  // Build category filter
  let categoryFilter = '';
  let queryParams = [];
  
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
    )`;
  });
  
  // All search terms must match (AND logic)
  const searchClause = searchConditions.join(' AND ');
  
  const sql = `
    SELECT id, name, category,
           ST_Y(location::geometry) AS lat,
           ST_X(location::geometry) AS lng,
           attributes
    FROM stores
    WHERE (${searchClause})${categoryFilter}
    ORDER BY name
    LIMIT ${Math.min(parseInt(limit) || 50, 50)}
  `;
  
  try {
    const result = await db.query(sql, queryParams);
    
    // Add address from attributes if available
    const stores = result.rows.map(store => ({
      ...store,
      address: store.attributes?.address || 'Address not available',
      lat: parseFloat(store.lat),
      lng: parseFloat(store.lng)
    }));
    
    res.json({ stores });
  } catch (err) {
    console.error('Global search error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Search for nearby stores by brand name
app.get('/api/search/nearby-brand', validateSearchQuery, async (req, res) => {
  const { brand, lat, lng, radius = 10 } = req.query;
  
  if (!brand || !lat || !lng) {
    return res.status(400).json({ error: 'Brand name, latitude, and longitude are required' });
  }
  
  const centerLat = parseFloat(lat);
  const centerLng = parseFloat(lng);
  const searchRadius = parseFloat(radius);
  
  if (isNaN(centerLat) || isNaN(centerLng) || isNaN(searchRadius)) {
    return res.status(400).json({ error: 'Invalid coordinates or radius' });
  }
  
  try {
    // Find all stores of the same brand within radius
    const sql = `
      SELECT id, name, category,
             ST_Y(location::geometry) AS lat,
             ST_X(location::geometry) AS lng,
             attributes,
             ST_Distance(
               location::geography,
               ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
             ) AS distance_meters
      FROM stores
      WHERE name ILIKE $3
      AND ST_DWithin(
        location::geography,
        ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
        $4
      )
      ORDER BY distance_meters
      LIMIT 20;
    `;
    
    const result = await db.query(sql, [
      centerLat,
      centerLng,
      `%${brand}%`,
      searchRadius * 1000 // Convert km to meters
    ]);
    
    // Add distance in km to results
    const storesWithDistance = result.rows.map(store => ({
      ...store,
      distance_km: (store.distance_meters / 1000).toFixed(2)
    }));
    
    res.json(storesWithDistance);
  } catch (err) {
    console.error('Nearby brand search error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Start server
const server = app.listen(SERVER_CONFIG.PORT, () => {
  console.log(`🚀 Server running on port ${SERVER_CONFIG.PORT}`);
  console.log(`📍 Environment: ${SERVER_CONFIG.NODE_ENV}`);
  console.log(`🌐 CORS origin: ${SERVER_CONFIG.CORS_ORIGIN}`);
  
  // Start automatic movement simulation
  startMovementSimulation();
  
  // Start driver status monitoring
  setTimeout(() => {
    const deliveryRouter = require('./routes/delivery');
    if (deliveryRouter.startDriverStatusMonitoring) {
      deliveryRouter.startDriverStatusMonitoring();
    }
  }, 2000); // Wait 2 seconds after server start
});

// Automatic movement simulation
function startMovementSimulation() {
  console.log('🎮 Starting automatic movement simulation...');
  
  const simulateMovement = async () => {
    try {
      const response = await fetch(`http://localhost:${SERVER_CONFIG.PORT}/delivery/simulate-movement`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        console.error('❌ Movement simulation failed:', response.status);
        return;
      }
      
      const result = await response.json();
      if (result.driversSimulated > 0) {
        console.log(`🎮 Simulated movement for ${result.driversSimulated} drivers`);
      }
    } catch (error) {
      console.error('❌ Movement simulation error:', error.message);
    }
  };
  
  // Run simulation every 3 seconds
  setInterval(simulateMovement, 3000);
}

// 404 handler for unmatched routes (MUST be after all route definitions)
app.use((req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: 'Route not found',
    message: `${req.method} ${req.originalUrl} does not exist`,
    timestamp: new Date().toISOString()
  });
});

// Handle server errors
server.on('error', (error) => {
  console.error('Server error:', error);
});

module.exports = app;