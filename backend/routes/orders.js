const express = require('express');
const router = express.Router();
const { ORDER_STATUS, SERVER_CONFIG } = require('../config/constants');
const { validateOrderCreation, validateStatusUpdate } = require('../middleware/validation');
const { requireAdmin, requireAuth, requireSameUserOrAdmin, requireUser } = require('../middleware/auth');
const { db } = require('../db');
const { isStoreOpenNow } = require('../utils/storeHours');

// Create new order
router.post('/', requireUser, validateOrderCreation, async (req, res) => {
    try {
        const { store_id, items, total_amount, order_type, customer_location } = req.body;
        const user_id = Number(req.auth.sub);
        
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
        
        // For delivery orders, ensure the fleet is online (assignment service picks a driver;
        // do not require is_available — busy drivers are marked unavailable during simulation)
        if (order_type === 'delivery') {
            const availableDrivers = await db.query(
                'SELECT COUNT(*) as count FROM drivers WHERE is_online = true'
            );

            if (Number(availableDrivers.rows[0].count) === 0) {
                return res.status(400).json({ error: 'No drivers available for delivery' });
            }
        }
        
        // Check if store is currently open
        if (!isStoreOpenNow(store.attributes)) {
            return res.status(400).json({ 
                error: `Store is currently closed. Store hours: ${store.attributes.open} - ${store.attributes.close}` 
            });
        }
        
        // Persist order and items in a single transaction
        await db.query('BEGIN');
        
        const orderResult = await db.query(
            'INSERT INTO orders (user_id, store_id, total_amount, order_type) VALUES ($1, $2, $3, $4) RETURNING *',
            [user_id, store_id, total_amount, order_type || ORDER_STATUS.EAT_IN]
        );
        
        const order = orderResult.rows[0];
        
        for (const item of items) {
            await db.query(
                'INSERT INTO order_items (order_id, item_name, quantity, price, notes) VALUES ($1, $2, $3, $4, $5)',
                [order.id, item.item_name || item.name, item.quantity, item.price, item.notes]
            );
        }
        
        await db.query('COMMIT');

        // Delivery assignment runs after the transaction is committed so that
        // the order record is visible to the assignment service. Failures here
        // do not roll back the order — the order stays pending and can be
        // assigned later.
        if (order_type === 'delivery') {
            try {
                const storeInfo = await db.query(
                    'SELECT ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng FROM stores WHERE id = $1',
                    [store_id]
                );
                
                if (storeInfo.rows.length > 0) {
                    const restaurantLocation = {
                        lat: parseFloat(storeInfo.rows[0].lat),
                        lng: parseFloat(storeInfo.rows[0].lng)
                    };
                    
                    const assignResult = await fetch(
                        `${SERVER_CONFIG.DRIVER_ASSIGNMENT_SERVICE_URL}/assign`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                orderId: order.id,
                                storeLocation: {
                                    lat: restaurantLocation.lat,
                                    lng: restaurantLocation.lng
                                },
                                customerLocation: customer_location
                            })
                        }
                    );
                    
                    if (assignResult.ok) {
                        const assignData = await assignResult.json();
                        const dn = assignData.driver?.driver_name || assignData.driver?.name;
                        console.log(`✅ Order ${order.id} assigned to driver ${dn || '(unknown)'}`);
                    } else {
                        console.warn(`⚠️  Could not assign driver to order ${order.id} - will remain unassigned`);
                    }
                }
            } catch (deliveryError) {
                console.error('Error assigning delivery:', deliveryError);
            }
        }
        
        res.json(order);
    } catch (error) {
        // Only roll back if the transaction was opened but not yet committed
        try { await db.query('ROLLBACK'); } catch (_) {}
        console.error('Error creating order:', error);
        res.status(500).json({ error: 'Failed to create order' });
    }
});

// Get user's orders
router.get('/user/:userId', requireAuth, requireSameUserOrAdmin('userId'), async (req, res) => {
    try {
        const { userId } = req.params;
        
        const result = await db.query(
            `SELECT o.*, o.created_at as order_date,
                    s.name as store_name, s.category as store_category, s.attributes->>'address' as store_address,
                    o.order_type, d.status as delivery_status, d.driver_id,
                    dr.name as driver_name, COALESCE(dr.license_plate, dr.car) as driver_car,
                    d.customer_location, d.estimated_delivery_time, d.delivered_at,
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
             LEFT JOIN LATERAL (
               SELECT d2.id, d2.order_id, d2.status, d2.driver_id,
                      d2.customer_location, d2.estimated_delivery_time, d2.delivered_at
               FROM deliveries d2
               WHERE d2.order_id = o.id
               ORDER BY d2.id DESC
               LIMIT 1
             ) d ON true
             LEFT JOIN drivers dr ON d.driver_id = dr.id
             WHERE o.user_id = $1
             GROUP BY o.id, s.name, s.category, s.attributes,
                      d.status, d.driver_id, dr.name, dr.license_plate, dr.car,
                      d.customer_location, d.estimated_delivery_time, d.delivered_at
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
router.patch('/:orderId/status', requireAdmin, validateStatusUpdate, async (req, res) => {
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
router.get('/admin/all', requireAdmin, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT o.*, o.created_at as order_date,
                    s.name as store_name, s.category as store_category, s.attributes->>'address' as store_address,
                    u.name as customer_name, u.email as user_email,
                    o.order_type, d.status as delivery_status, d.driver_id,
                    dr.name as driver_name, COALESCE(dr.license_plate, dr.car) as driver_car,
                    d.customer_location, d.estimated_delivery_time, d.delivered_at,
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
             LEFT JOIN LATERAL (
               SELECT d2.id, d2.order_id, d2.status, d2.driver_id,
                      d2.customer_location, d2.estimated_delivery_time, d2.delivered_at
               FROM deliveries d2
               WHERE d2.order_id = o.id
               ORDER BY d2.id DESC
               LIMIT 1
             ) d ON true
             LEFT JOIN drivers dr ON d.driver_id = dr.id
             GROUP BY o.id, s.name, s.category, s.attributes,
                      u.name, u.email, d.status, d.driver_id, dr.name, dr.license_plate, dr.car,
                      d.customer_location, d.estimated_delivery_time, d.delivered_at
             ORDER BY o.id DESC`
        );
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching all orders:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// Delete order (Admin only)
router.delete('/:orderId', requireAdmin, async (req, res) => {
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
