const express = require('express');
const router = express.Router();
const { TORONTO_BOUNDS, API_LIMITS } = require('../config/constants');
const { validateSearchQuery } = require('../middleware/validation');
const { db } = require('../db');

router.get('/', validateSearchQuery, async (req, res) => {
  const query = req.query.q || '';
  const { categories, limit } = req.query;

  if (!query.trim()) return res.json([]);

  const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);

  let queryParams = [
    TORONTO_BOUNDS.SOUTH,
    TORONTO_BOUNDS.NORTH,
    TORONTO_BOUNDS.WEST,
    TORONTO_BOUNDS.EAST
  ];
  let categoryFilter = '';

  if (categories) {
    categoryFilter = ` AND category = ANY($${queryParams.length + 1})`;
    queryParams.push(categories.split(','));
  }

  const searchConditions = searchTerms.map(term => {
    const i = queryParams.length + 1;
    queryParams.push(`%${term}%`);
    return `(
      name ILIKE $${i}
      OR category ILIKE $${i}
      OR (attributes->>'address') ILIKE $${i}
      OR (attributes->>'phone') ILIKE $${i}
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(attributes->'products') AS prod
        WHERE prod ILIKE $${i}
      )
    )`;
  });

  const sql = `
    SELECT id, name, category,
           ST_Y(location::geometry) AS lat,
           ST_X(location::geometry) AS lng,
           attributes
    FROM stores
    WHERE (${searchConditions.join(' AND ')})
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

router.get('/global', validateSearchQuery, async (req, res) => {
  const query = req.query.q || '';
  const { categories, limit } = req.query;

  if (!query.trim()) {
    try {
      const result = await db.query(`
        SELECT id, name, category,
               ST_Y(location::geometry) AS lat,
               ST_X(location::geometry) AS lng,
               attributes
        FROM stores ORDER BY name LIMIT 20
      `);
      return res.json({
        stores: result.rows.map(s => ({
          ...s,
          address: s.attributes?.address || 'Address not available',
          lat: parseFloat(s.lat),
          lng: parseFloat(s.lng)
        }))
      });
    } catch (err) {
      return res.status(500).json({ error: 'Server error' });
    }
  }

  const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
  let queryParams = [];
  let categoryFilter = '';

  if (categories) {
    categoryFilter = ` AND category = ANY($${queryParams.length + 1})`;
    queryParams.push(categories.split(','));
  }

  const searchConditions = searchTerms.map(term => {
    const i = queryParams.length + 1;
    queryParams.push(`%${term}%`);
    return `(
      name ILIKE $${i}
      OR category ILIKE $${i}
      OR (attributes->>'address') ILIKE $${i}
    )`;
  });

  const sql = `
    SELECT id, name, category,
           ST_Y(location::geometry) AS lat,
           ST_X(location::geometry) AS lng,
           attributes
    FROM stores
    WHERE (${searchConditions.join(' AND ')})${categoryFilter}
    ORDER BY name
    LIMIT ${Math.min(parseInt(limit) || 50, 50)}
  `;

  try {
    const result = await db.query(sql, queryParams);
    res.json({
      stores: result.rows.map(s => ({
        ...s,
        address: s.attributes?.address || 'Address not available',
        lat: parseFloat(s.lat),
        lng: parseFloat(s.lng)
      }))
    });
  } catch (err) {
    console.error('Global search error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/nearby-brand', validateSearchQuery, async (req, res) => {
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
    const result = await db.query(`
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
      LIMIT 20
    `, [centerLat, centerLng, `%${brand}%`, searchRadius * 1000]);

    res.json(result.rows.map(s => ({
      ...s,
      distance_km: (s.distance_meters / 1000).toFixed(2)
    })));
  } catch (err) {
    console.error('Nearby brand search error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/debug/stores', async (req, res) => {
  try {
    const total = await db.query('SELECT COUNT(*) FROM stores');
    const sample = await db.query('SELECT id, name, category FROM stores LIMIT 5');
    res.json({ total_stores: total.rows[0].count, sample_stores: sample.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
