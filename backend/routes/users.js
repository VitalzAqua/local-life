const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../db');

// Register new user
router.post('/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const result = await db.query(
            'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name',
            [email, hashedPassword, name]
        );
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ error: 'Failed to register user' });
    }
});

// Login user
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const result = await db.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Don't send password hash to client
        delete user.password_hash;
        res.json(user);
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ error: 'Failed to login' });
    }
});

// Admin: Get all users
router.get('/admin/all', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                u.id,
                u.email,
                u.name,
                u.created_at,
                COUNT(DISTINCT o.id) as total_orders,
                COUNT(DISTINCT r.id) as total_reservations,
                COALESCE(SUM(o.total_amount), 0) as total_spent
            FROM users u
            LEFT JOIN orders o ON u.id = o.user_id
            LEFT JOIN reservations r ON u.id = r.user_id
            GROUP BY u.id, u.email, u.name, u.created_at
            ORDER BY u.created_at DESC
        `);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching all users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Admin: Get user details with orders and reservations
router.get('/admin/:userId/details', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Get user info with aggregated stats
        const userResult = await db.query(`
            SELECT 
                u.id,
                u.email,
                u.name,
                u.created_at,
                COUNT(DISTINCT o.id) as total_orders,
                COUNT(DISTINCT r.id) as total_reservations,
                COALESCE(SUM(o.total_amount), 0) as total_spent
            FROM users u
            LEFT JOIN orders o ON u.id = o.user_id
            LEFT JOIN reservations r ON u.id = r.user_id
            WHERE u.id = $1
            GROUP BY u.id, u.email, u.name, u.created_at
        `, [userId]);
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const user = userResult.rows[0];
        
        // Get user orders with items
        const ordersResult = await db.query(`
            SELECT o.*, s.name as store_name, s.attributes->>'address' as store_address,
                   COALESCE(
                       json_agg(
                           json_build_object(
                               'id', oi.id,
                               'item_name', oi.item_name,
                               'quantity', oi.quantity,
                               'price', oi.price,
                               'notes', oi.notes
                           )
                       ) FILTER (WHERE oi.id IS NOT NULL), 
                       '[]'::json
                   ) as items
            FROM orders o
            LEFT JOIN stores s ON o.store_id = s.id
            LEFT JOIN order_items oi ON o.id = oi.order_id
            WHERE o.user_id = $1
            GROUP BY o.id, s.name, s.attributes
            ORDER BY o.created_at DESC
        `, [userId]);
        
        // Get user reservations
        const reservationsResult = await db.query(`
            SELECT r.*, s.name as store_name, s.attributes->>'address' as store_address
            FROM reservations r
            LEFT JOIN stores s ON r.store_id = s.id
            WHERE r.user_id = $1
            ORDER BY r.created_at DESC
        `, [userId]);
        
        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                created_at: user.created_at
            },
            totalOrders: parseInt(user.total_orders),
            totalReservations: parseInt(user.total_reservations),
            totalSpent: parseFloat(user.total_spent).toFixed(2),
            orders: ordersResult.rows,
            reservations: reservationsResult.rows
        });
    } catch (error) {
        console.error('Error fetching user details:', error);
        res.status(500).json({ error: 'Failed to fetch user details' });
    }
});

module.exports = router; 