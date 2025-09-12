const express = require('express');
const router = express.Router();
// Use the global db object created in index.js
const db = global.db;

// Helper function for database queries with timeout
const queryWithTimeout = async (query, params = [], timeoutMs = 20000) => {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Database query timeout')), timeoutMs);
  });
  
  try {
    const queryPromise = pool.query(query, params);
    return await Promise.race([queryPromise, timeoutPromise]);
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

// Nearby stores endpoint 
router.get('/', async (req, res) => {
  try {
    const { lat, lng, radius, categories } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const numLat = parseFloat(lat);
    const numLng = parseFloat(lng);
    const searchRadius = parseFloat(radius) || 10; // Default 10km radius
    
    if (isNaN(numLat) || isNaN(numLng) || isNaN(searchRadius)) {
      return res.status(400).json({ error: 'Invalid coordinates or radius' });
    }

    // Build the query
    let sql = `
      SELECT 
        id, name, category,
        ST_Y(location::geometry) AS lat,
        ST_X(location::geometry) AS lng,
        attributes,
        ROUND(ST_Distance(location, ST_SetSRID(ST_MakePoint($2, $1), 4326))::numeric, 0) AS distance_meters
      FROM stores
      WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint($2, $1), 4326), $3)
    `;
    
    let queryParams = [numLat, numLng, searchRadius * 1000]; // Convert km to meters
    
    // Add category filter if provided
    if (categories) {
      const categoryArray = categories.split(',').map(c => c.trim());
      sql += ` AND category = ANY($4)`;
      queryParams.push(categoryArray);
    }
    
    sql += ` ORDER BY distance_meters ASC LIMIT 50`;
    
    const result = await db.query(sql, queryParams);
    
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Nearby stores error:', err);
    res.status(500).json({
      error: 'Failed to fetch nearby stores',
      message: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// All stores endpoint (no location filtering)
router.get('/all', async (req, res) => {
  try {
    const { categories } = req.query;
    
    let sql = `
      SELECT 
        id, name, category,
        ST_Y(location::geometry) AS lat,
        ST_X(location::geometry) AS lng,
        attributes
      FROM stores
    `;
    
    let queryParams = [];
    
    // Add category filter if provided
    if (categories) {
      const categoryArray = categories.split(',').map(c => c.trim());
      sql += ` WHERE category = ANY($1)`;
      queryParams.push(categoryArray);
    }
    
    sql += ` ORDER BY name LIMIT 100`;
    
    const result = await db.query(sql, queryParams);
    
    res.json(result.rows);
  } catch (err) {
    console.error('❌ All stores error:', err);
    res.status(500).json({
      error: 'Failed to fetch stores',
      message: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// Store categories endpoint
router.get('/categories', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT DISTINCT category 
      FROM stores 
      WHERE category IS NOT NULL 
      ORDER BY category
    `);
    
    const categories = result.rows.map(row => row.category);
    res.json(categories);
  } catch (err) {
    console.error('❌ Categories error:', err);
    res.status(500).json({
      error: 'Failed to fetch categories',
      message: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

module.exports = router;
