const express = require('express');
const router = express.Router();
// Use the global db object created in index.js
const db = global.db;

// Get all saved locations for a user
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const result = await db.query(`
            SELECT 
                sl.id,
                sl.location_name,
                sl.notes,
                sl.created_at,
                s.id as store_id,
                s.name as store_name,
                s.category,
                ST_Y(s.location::geometry) as lat,
                ST_X(s.location::geometry) as lng,
                s.attributes
            FROM saved_locations sl
            JOIN stores s ON sl.store_id = s.id
            WHERE sl.user_id = $1
            ORDER BY sl.created_at DESC
        `, [userId]);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching saved locations:', error);
        res.status(500).json({ error: 'Failed to fetch saved locations' });
    }
});

// Save a new location
router.post('/', async (req, res) => {
    try {
        const { userId, storeId, locationName, notes } = req.body;
        
        // Validate required fields
        if (!userId || !storeId || !locationName) {
            return res.status(400).json({ 
                error: 'User ID, store ID, and location name are required' 
            });
        }
        
        const result = await db.query(`
            INSERT INTO saved_locations (user_id, store_id, location_name, notes)
            VALUES ($1, $2, $3, $4)
            RETURNING id, location_name, notes, created_at
        `, [userId, storeId, locationName.trim(), notes?.trim() || null]);
        
        res.json(result.rows[0]);
    } catch (error) {
        if (error.constraint === 'idx_unique_user_store') {
            return res.status(409).json({ error: 'Location already saved' });
        }
        console.error('Error saving location:', error);
        res.status(500).json({ error: 'Failed to save location' });
    }
});

// Update a saved location
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { locationName, notes, userId } = req.body;
        
        // Validate required fields
        if (!locationName || !userId) {
            return res.status(400).json({ 
                error: 'Location name and user ID are required' 
            });
        }
        
        const result = await db.query(`
            UPDATE saved_locations 
            SET location_name = $1, notes = $2
            WHERE id = $3 AND user_id = $4
            RETURNING id, location_name, notes, created_at
        `, [locationName.trim(), notes?.trim() || null, id, userId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Saved location not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating saved location:', error);
        res.status(500).json({ error: 'Failed to update saved location' });
    }
});

// Delete a saved location
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }
        
        const result = await db.query(`
            DELETE FROM saved_locations 
            WHERE id = $1 AND user_id = $2
            RETURNING id
        `, [id, userId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Saved location not found' });
        }
        
        res.json({ message: 'Location removed from saved list' });
    } catch (error) {
        console.error('Error deleting saved location:', error);
        res.status(500).json({ error: 'Failed to delete saved location' });
    }
});

// Check if a location is saved by user
router.get('/check/:userId/:storeId', async (req, res) => {
    try {
        const { userId, storeId } = req.params;
        
        const result = await db.query(`
            SELECT id FROM saved_locations 
            WHERE user_id = $1 AND store_id = $2
        `, [userId, storeId]);
        
        res.json({ isSaved: result.rows.length > 0 });
    } catch (error) {
        console.error('Error checking saved location:', error);
        res.status(500).json({ error: 'Failed to check saved location' });
    }
});

module.exports = router; 