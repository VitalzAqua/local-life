const express = require('express');
const router = express.Router();
const { requireAuth, requireSameUserOrAdmin, requireUser } = require('../middleware/auth');
const { db } = require('../db');

router.get('/user/:userId', requireAuth, requireSameUserOrAdmin('userId'), async (req, res) => {
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

router.post('/', requireUser, async (req, res) => {
    try {
        const { store_id, location_name, notes } = req.body;
        const user_id = Number(req.auth.sub);
        
        if (!store_id || !location_name) {
            return res.status(400).json({ 
                error: 'Store ID and location name are required' 
            });
        }
        
        const result = await db.query(`
            INSERT INTO saved_locations (user_id, store_id, location_name, notes)
            VALUES ($1, $2, $3, $4)
            RETURNING id, location_name, notes, created_at
        `, [user_id, store_id, location_name.trim(), notes?.trim() || null]);
        
        res.json(result.rows[0]);
    } catch (error) {
        if (error.constraint === 'idx_unique_user_store') {
            return res.status(409).json({ error: 'Location already saved' });
        }
        console.error('Error saving location:', error);
        res.status(500).json({ error: 'Failed to save location' });
    }
});

router.put('/:id', requireUser, async (req, res) => {
    try {
        const { id } = req.params;
        const { location_name, notes } = req.body;
        const user_id = Number(req.auth.sub);
        
        if (!location_name) {
            return res.status(400).json({ 
                error: 'Location name is required' 
            });
        }
        
        const result = await db.query(`
            UPDATE saved_locations 
            SET location_name = $1, notes = $2
            WHERE id = $3 AND user_id = $4
            RETURNING id, location_name, notes, created_at
        `, [location_name.trim(), notes?.trim() || null, id, user_id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Saved location not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating saved location:', error);
        res.status(500).json({ error: 'Failed to update saved location' });
    }
});

router.delete('/:id', requireUser, async (req, res) => {
    try {
        const { id } = req.params;
        const user_id = Number(req.auth.sub);
        
        const result = await db.query(`
            DELETE FROM saved_locations 
            WHERE id = $1 AND user_id = $2
            RETURNING id
        `, [id, user_id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Saved location not found' });
        }
        
        res.json({ message: 'Location removed from saved list' });
    } catch (error) {
        console.error('Error deleting saved location:', error);
        res.status(500).json({ error: 'Failed to delete saved location' });
    }
});

router.get('/check/:userId/:storeId', requireAuth, requireSameUserOrAdmin('userId'), async (req, res) => {
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
