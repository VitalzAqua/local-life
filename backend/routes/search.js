const express = require('express');
const router = express.Router();
const { TORONTO_BOUNDS, API_LIMITS } = require('../config/constants');
const { validateSearchQuery } = require('../middleware/validation');
const { db } = require('../db');

const normalizeSearchValue = (value = '') =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const tokenize = (value = '') => normalizeSearchValue(value).split(/\s+/).filter(Boolean);

const toRadians = (value) => (value * Math.PI) / 180;

const calculateDistanceKm = (fromLat, fromLng, toLat, toLng) => {
  if (
    !Number.isFinite(fromLat) ||
    !Number.isFinite(fromLng) ||
    !Number.isFinite(toLat) ||
    !Number.isFinite(toLng)
  ) {
    return null;
  }

  const earthRadiusKm = 6371;
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(fromLat)) *
      Math.cos(toRadians(toLat)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getAutocompleteScore = (store, query) => {
  const normalizedQuery = normalizeSearchValue(query);
  const searchTerms = tokenize(query);

  if (!normalizedQuery || searchTerms.length === 0) {
    return 0;
  }

  const normalizedName = normalizeSearchValue(store.name);
  const normalizedCategory = normalizeSearchValue(store.category);
  const normalizedAddress = normalizeSearchValue(store.address);
  const nameTokens = tokenize(store.name);
  const addressTokens = tokenize(store.address);

  let score = 0;

  if (normalizedName === normalizedQuery) {
    score += 400;
  } else if (normalizedName.startsWith(normalizedQuery)) {
    score += normalizedQuery.length === 1 ? 320 : 260;
  } else if (nameTokens.some(token => token.startsWith(normalizedQuery))) {
    score += 220;
  } else if (normalizedName.includes(normalizedQuery)) {
    score += 150;
  }

  if (normalizedCategory === normalizedQuery) {
    score += 180;
  } else if (normalizedCategory.startsWith(normalizedQuery)) {
    score += 120;
  } else if (normalizedCategory.includes(normalizedQuery)) {
    score += 70;
  }

  if (normalizedAddress.startsWith(normalizedQuery)) {
    score += 90;
  } else if (addressTokens.some(token => token.startsWith(normalizedQuery))) {
    score += 75;
  } else if (normalizedAddress.includes(normalizedQuery)) {
    score += 40;
  }

  searchTerms.forEach(term => {
    if (nameTokens.some(token => token.startsWith(term))) {
      score += 40;
    } else if (normalizedName.includes(term)) {
      score += 20;
    }

    if (normalizedCategory.includes(term)) {
      score += 15;
    }

    if (addressTokens.some(token => token.startsWith(term))) {
      score += 10;
    }
  });

  return score;
};

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
        SELECT 1
        FROM jsonb_array_elements(COALESCE(attributes->'products', '[]'::jsonb)) AS prod
        WHERE (prod->>'name') ILIKE $${i}
           OR (prod->>'description') ILIKE $${i}
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
  const { categories, limit, lat, lng } = req.query;
  const userLat = parseFloat(lat);
  const userLng = parseFloat(lng);
  const hasUserLocation = Number.isFinite(userLat) && Number.isFinite(userLng);

  if (!query.trim()) {
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

      return res.json({
        stores: result.rows.map(store => ({
          ...store,
          address: store.attributes?.address || 'Address not available',
          lat: parseFloat(store.lat),
          lng: parseFloat(store.lng)
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
    LIMIT 250
  `;

  try {
    const result = await db.query(sql, queryParams);
    const rankedStores = result.rows
      .map(store => {
        const latValue = parseFloat(store.lat);
        const lngValue = parseFloat(store.lng);
        const address = store.attributes?.address || 'Address not available';
        const distanceKm = hasUserLocation
          ? calculateDistanceKm(userLat, userLng, latValue, lngValue)
          : null;

        return {
          ...store,
          address,
          lat: latValue,
          lng: lngValue,
          score: getAutocompleteScore(
            { name: store.name, category: store.category, address },
            query
          ),
          distance_km: distanceKm
        };
      })
      .filter(store => store.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }

        if (a.distance_km != null && b.distance_km != null && a.distance_km !== b.distance_km) {
          return a.distance_km - b.distance_km;
        }

        return a.name.localeCompare(b.name);
      })
      .slice(0, Math.min(parseInt(limit) || 50, 50));

    res.json({ stores: rankedStores });
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

    res.json(result.rows.map(store => ({
      ...store,
      distance_km: (store.distance_meters / 1000).toFixed(2)
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
