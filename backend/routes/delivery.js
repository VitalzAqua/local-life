const express = require('express');
const router = express.Router();
const db = require('../db');

// Get available drivers
router.get('/drivers/available', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM drivers WHERE is_available = true ORDER BY id'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching available drivers:', error);
        res.status(500).json({ error: 'Failed to fetch available drivers' });
    }
});

// Assign driver to delivery
router.post('/assign-driver', async (req, res) => {
    try {
        const { order_id, order_type, customer_location } = req.body;
        
        if (order_type === 'eat_in') {
            // For eat-in orders, just create delivery record without driver
            const deliveryResult = await db.query(
                'INSERT INTO deliveries (order_id, order_type) VALUES ($1, $2) RETURNING *',
                [order_id, order_type]
            );
            return res.json({ delivery: deliveryResult.rows[0] });
        }
        
        // For delivery orders, find an available driver
        const availableDrivers = await db.query(
            'SELECT * FROM drivers WHERE is_available = true ORDER BY RANDOM() LIMIT 1'
        );
        
        if (availableDrivers.rows.length === 0) {
            return res.status(400).json({ error: 'No drivers available for delivery' });
        }
        
        const driver = availableDrivers.rows[0];
        
        // Calculate estimated completion time (30 seconds from now)
        const estimatedTime = new Date();
        estimatedTime.setSeconds(estimatedTime.getSeconds() + 30);
        
        await db.query('BEGIN');
        
        // Mark driver as unavailable
        await db.query(
            'UPDATE drivers SET is_available = false WHERE id = $1',
            [driver.id]
        );
        
        // Create delivery record
        const deliveryResult = await db.query(
            'INSERT INTO deliveries (order_id, driver_id, order_type, customer_location, estimated_completion_time) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [order_id, driver.id, order_type, customer_location, estimatedTime]
        );
        
        await db.query('COMMIT');
        
        // Schedule automatic completion
        setTimeout(async () => {
            try {
                await db.query('BEGIN');
                
                // Mark delivery as completed
                await db.query(
                    'UPDATE deliveries SET completed_at = CURRENT_TIMESTAMP WHERE id = $1',
                    [deliveryResult.rows[0].id]
                );
                
                // Update order status to completed
                await db.query(
                    'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                    ['completed', order_id]
                );
                
                // Free the driver
                await db.query(
                    'UPDATE drivers SET is_available = true WHERE id = $1',
                    [driver.id]
                );
                
                await db.query('COMMIT');
                console.log(`Delivery ${deliveryResult.rows[0].id} completed automatically`);
            } catch (error) {
                await db.query('ROLLBACK');
                console.error('Error completing delivery automatically:', error);
            }
        }, 30 * 1000); // 30 seconds
        
        res.json({ 
            delivery: deliveryResult.rows[0], 
            driver: driver,
            estimated_completion_time: estimatedTime
        });
        
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error assigning driver:', error);
        res.status(500).json({ error: 'Failed to assign driver' });
    }
});

// Get delivery info for an order
router.get('/order/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        
        const result = await db.query(
            `SELECT d.*, dr.name as driver_name, dr.car as driver_car
             FROM deliveries d
             LEFT JOIN drivers dr ON d.driver_id = dr.id
             WHERE d.order_id = $1`,
            [orderId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Delivery not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching delivery info:', error);
        res.status(500).json({ error: 'Failed to fetch delivery info' });
    }
});

module.exports = router; 