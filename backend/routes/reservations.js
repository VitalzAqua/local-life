const express = require('express');
const router = express.Router();
const { RESERVATION_STATUS } = require('../config/constants');
const { validateReservationCreation, validateStatusUpdate } = require('../middleware/validation');
const { requireAdmin, requireAuth, requireSameUserOrAdmin, requireUser } = require('../middleware/auth');
const { db } = require('../db');
const {
    isFutureBusinessDateTime,
    isReservationWithinStoreHours
} = require('../utils/storeHours');

// Create new reservation
router.post('/', requireUser, validateReservationCreation, async (req, res) => {
    try {
        const { store_id, reservation_date, party_size, notes } = req.body;
        const user_id = Number(req.auth.sub);
        
        // Get store information to check hours
        const storeResult = await db.query(
            'SELECT attributes FROM stores WHERE id = $1',
            [store_id]
        );
        
        if (storeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Store not found' });
        }
        
        const store = storeResult.rows[0];
        
        // Check if reservation time is within store hours
        if (!isReservationWithinStoreHours(reservation_date, store.attributes)) {
            return res.status(400).json({ 
                error: `Reservation time is outside store hours. Store hours: ${store.attributes.open} - ${store.attributes.close}` 
            });
        }
        
        // Check if reservation is in the future
        if (!isFutureBusinessDateTime(reservation_date)) {
            return res.status(400).json({ error: 'Reservation must be in the future' });
        }
        
        const result = await db.query(
            `INSERT INTO reservations 
             (user_id, store_id, reservation_date, party_size, notes) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING *`,
            [user_id, store_id, reservation_date, party_size, notes]
        );
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error creating reservation:', error);
        res.status(500).json({ error: 'Failed to create reservation' });
    }
});

// Get user's reservations
router.get('/user/:userId', requireAuth, requireSameUserOrAdmin('userId'), async (req, res) => {
    try {
        const { userId } = req.params;
        
        const result = await db.query(
            `SELECT r.*, s.name as store_name, s.attributes->>'address' as store_address
             FROM reservations r
             LEFT JOIN stores s ON r.store_id = s.id
             WHERE r.user_id = $1
             ORDER BY r.id DESC`,
            [userId]
        );
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching reservations:', error);
        res.status(500).json({ error: 'Failed to fetch reservations' });
    }
});

// Get store's reservations for a specific date
router.get('/store/:storeId/date/:date', requireAdmin, async (req, res) => {
    try {
        const { storeId, date } = req.params;
        
        const result = await db.query(
            `SELECT r.*, u.name as user_name
             FROM reservations r
             JOIN users u ON r.user_id = u.id
             WHERE r.store_id = $1 
             AND DATE(r.reservation_date) = DATE($2)
             ORDER BY r.reservation_date`,
            [storeId, date]
        );
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching store reservations:', error);
        res.status(500).json({ error: 'Failed to fetch store reservations' });
    }
});

// Update reservation status
router.patch('/:reservationId/status', requireAdmin, validateStatusUpdate, async (req, res) => {
    try {
        const { reservationId } = req.params;
        const { status } = req.body;
        
        const result = await db.query(
            'UPDATE reservations SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
            [status, reservationId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Reservation not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating reservation status:', error);
        res.status(500).json({ error: 'Failed to update reservation status' });
    }
});

// Admin route - Get all reservations
router.get('/admin/all', requireAdmin, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT r.*, s.name as store_name, s.attributes->>'address' as store_address,
                    u.name as customer_name, u.email as user_email
             FROM reservations r
             LEFT JOIN stores s ON r.store_id = s.id
             LEFT JOIN users u ON r.user_id = u.id
             ORDER BY r.id DESC`
        );
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching all reservations:', error);
        res.status(500).json({ error: 'Failed to fetch reservations' });
    }
});

// Delete reservation (Admin only)
router.delete('/:reservationId', requireAdmin, async (req, res) => {
    try {
        const { reservationId } = req.params;
        
        const result = await db.query('DELETE FROM reservations WHERE id = $1 RETURNING *', [reservationId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Reservation not found' });
        }
        
        res.json({ message: 'Reservation deleted successfully', reservation: result.rows[0] });
    } catch (error) {
        console.error('Error deleting reservation:', error);
        res.status(500).json({ error: 'Failed to delete reservation' });
    }
});

module.exports = router; 
