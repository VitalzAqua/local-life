const express = require('express');
const router = express.Router();
const db = require('../db');

// Helper function to check if current time is within store hours
const isWithinStoreHours = (storeHours) => {
  if (!storeHours.open || !storeHours.close) return true; // If no hours specified, allow all times
  
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
  
  return currentTime >= storeHours.open && currentTime <= storeHours.close;
};

// Create new order
router.post('/', async (req, res) => {
    try {
        const { user_id, store_id, items, total_amount, order_type, customer_location } = req.body;
        
        // Check if user is authenticated
        if (!user_id) {
            return res.status(401).json({ error: 'Authentication required to place orders' });
        }
        
        // Get store information to check hours and category
        const storeResult = await db.query(
            'SELECT attributes, category FROM stores WHERE id = $1',
            [store_id]
        );
        
        if (storeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Store not found' });
        }
        
        const store = storeResult.rows[0];
        
        // Check if delivery is being requested for non-restaurant
        if (order_type === 'delivery' && store.category !== 'restaurant') {
            return res.status(400).json({ error: 'Delivery is only available for restaurants' });
        }
        
        // For delivery orders, check if drivers are available
        if (order_type === 'delivery') {
            const availableDrivers = await db.query(
                'SELECT COUNT(*) as count FROM drivers WHERE is_available = true'
            );
            
            if (availableDrivers.rows[0].count == 0) {
                return res.status(400).json({ error: 'No drivers available for delivery' });
            }
        }
        
        // Check if store is currently open
        if (!isWithinStoreHours(store.attributes)) {
            return res.status(400).json({ 
                error: `Store is currently closed. Store hours: ${store.attributes.open} - ${store.attributes.close}` 
            });
        }
        
        // Start a transaction
        await db.query('BEGIN');
        
        // Create the order
        const orderResult = await db.query(
            'INSERT INTO orders (user_id, store_id, total_amount) VALUES ($1, $2, $3) RETURNING *',
            [user_id, store_id, total_amount]
        );
        
        const order = orderResult.rows[0];
        
        // Add order items
        for (const item of items) {
            await db.query(
                'INSERT INTO order_items (order_id, item_name, quantity, price, notes) VALUES ($1, $2, $3, $4, $5)',
                [order.id, item.name, item.quantity, item.price, item.notes]
            );
        }
        
        await db.query('COMMIT');
        
        // Create delivery record and assign driver if needed
        if (order_type) {
            try {
                // Import delivery logic directly instead of making HTTP call
                if (order_type === 'eat_in') {
                    // For eat-in orders, just create delivery record without driver
                    await db.query(
                        'INSERT INTO deliveries (order_id, order_type) VALUES ($1, $2)',
                        [order.id, order_type]
                    );
                } else if (order_type === 'delivery') {
                    // For delivery orders, find an available driver
                    const availableDrivers = await db.query(
                        'SELECT * FROM drivers WHERE is_available = true ORDER BY RANDOM() LIMIT 1'
                    );
                    
                    if (availableDrivers.rows.length > 0) {
                        const driver = availableDrivers.rows[0];
                        
                        // Calculate estimated completion time (30 seconds from now)
                        const estimatedTime = new Date();
                        estimatedTime.setSeconds(estimatedTime.getSeconds() + 30);
                        
                        // Mark driver as unavailable
                        await db.query(
                            'UPDATE drivers SET is_available = false WHERE id = $1',
                            [driver.id]
                        );
                        
                        // Create delivery record
                        await db.query(
                            'INSERT INTO deliveries (order_id, driver_id, order_type, customer_location, estimated_completion_time) VALUES ($1, $2, $3, $4, $5)',
                            [order.id, driver.id, order_type, customer_location, estimatedTime]
                        );
                        
                        // Schedule automatic completion
                        setTimeout(async () => {
                            try {
                                await db.query('BEGIN');
                                
                                // Mark delivery as completed
                                await db.query(
                                    'UPDATE deliveries SET completed_at = CURRENT_TIMESTAMP WHERE order_id = $1',
                                    [order.id]
                                );
                                
                                // Update order status to completed
                                await db.query(
                                    'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                                    ['completed', order.id]
                                );
                                
                                // Free the driver
                                await db.query(
                                    'UPDATE drivers SET is_available = true WHERE id = $1',
                                    [driver.id]
                                );
                                
                                await db.query('COMMIT');
                                console.log(`Delivery for order ${order.id} completed automatically`);
                            } catch (error) {
                                await db.query('ROLLBACK');
                                console.error('Error completing delivery automatically:', error);
                            }
                        }, 30 * 1000); // 30 seconds
                    }
                }
            } catch (deliveryError) {
                console.error('Error creating delivery:', deliveryError);
                // Don't fail the order if delivery assignment fails
            }
        }
        
        res.json(order);
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error creating order:', error);
        res.status(500).json({ error: 'Failed to create order' });
    }
});

// Get user's orders
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const result = await db.query(
            `SELECT o.*, s.name as store_name, s.category as store_category, s.attributes->>'address' as store_address,
                    d.order_type, d.driver_id, dr.name as driver_name, dr.car as driver_car,
                    d.customer_location, d.estimated_completion_time, d.completed_at,
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
             LEFT JOIN deliveries d ON o.id = d.order_id
             LEFT JOIN drivers dr ON d.driver_id = dr.id
             WHERE o.user_id = $1
             GROUP BY o.id, s.name, s.category, s.attributes, d.order_type, d.driver_id, dr.name, dr.car, d.customer_location, d.estimated_completion_time, d.completed_at
             ORDER BY o.id DESC`,
            [userId]
        );
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// Update order status
router.patch('/:orderId/status', async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;
        
        const result = await db.query(
            'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
            [status, orderId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ error: 'Failed to update order status' });
    }
});

// Admin route - Get all orders
router.get('/admin/all', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT o.*, s.name as store_name, s.category as store_category, s.attributes->>'address' as store_address,
                    u.name as customer_name, u.email as user_email,
                    d.order_type, d.driver_id, dr.name as driver_name, dr.car as driver_car,
                    d.customer_location, d.estimated_completion_time, d.completed_at,
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
             LEFT JOIN users u ON o.user_id = u.id
             LEFT JOIN order_items oi ON o.id = oi.order_id
             LEFT JOIN deliveries d ON o.id = d.order_id
             LEFT JOIN drivers dr ON d.driver_id = dr.id
             GROUP BY o.id, s.name, s.category, s.attributes, u.name, u.email, d.order_type, d.driver_id, dr.name, dr.car, d.customer_location, d.estimated_completion_time, d.completed_at
             ORDER BY o.id DESC`
        );
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching all orders:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// Delete order (Admin only)
router.delete('/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        
        // Start transaction
        await db.query('BEGIN');
        
        // Delete order items first (foreign key constraint)
        await db.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);
        
        // Delete the order
        const result = await db.query('DELETE FROM orders WHERE id = $1 RETURNING *', [orderId]);
        
        if (result.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Order not found' });
        }
        
        await db.query('COMMIT');
        
        res.json({ message: 'Order deleted successfully', order: result.rows[0] });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error deleting order:', error);
        res.status(500).json({ error: 'Failed to delete order' });
    }
});

module.exports = router;