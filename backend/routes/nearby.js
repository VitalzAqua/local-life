const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  const { lat, lng, radius, categories } = req.query;

  if (!lat || !lng || !radius) {
    return res.status(400).json({ error: 'Missing lat, lng, or radius' });
  }

  try {
    // Build category filter
    let categoryFilter = '';
    let queryParams = [parseFloat(lng), parseFloat(lat), parseInt(radius)];
    
    if (categories && categories.length > 0) {
      const categoryArray = categories.split(',');
      categoryFilter = ` AND category = ANY($4)`;
      queryParams.push(categoryArray);
    }

    const result = await pool.query(`
      SELECT id, name, category,
             ST_Y(location::geometry) AS lat,
             ST_X(location::geometry) AS lng,
             attributes
      FROM stores
      WHERE ST_DWithin(
        location,
        ST_MakePoint($1, $2)::geography,
        $3
      )${categoryFilter}
      LIMIT 100;
    `, queryParams);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

router.get('/all', async (req, res) => {
  const { categories } = req.query;
  
  try {
    // Build category filter
    let categoryFilter = '';
    let queryParams = [];
    
    if (categories && categories.length > 0) {
      const categoryArray = categories.split(',');
      categoryFilter = ` WHERE category = ANY($1)`;
      queryParams.push(categoryArray);
    }

    const result = await pool.query(`
      SELECT id, name, category,
             ST_Y(location::geometry) AS lat,
             ST_X(location::geometry) AS lng,
             attributes
      FROM stores${categoryFilter}
      ORDER BY name;
    `, queryParams);
    
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get available categories
router.get('/categories', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT category 
      FROM stores 
      ORDER BY category;
    `);
    res.json(result.rows.map(row => row.category));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
