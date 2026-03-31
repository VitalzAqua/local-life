const express = require('express');
const router = express.Router();
const { attachAuth, requireAdmin } = require('../middleware/auth');
const { db } = require('../db');

// Distance calculation using the Haversine formula.
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

router.post('/drivers/:driverId/location', requireAdmin, async (req, res) => {
    try {
        const { driverId } = req.params;
        const { lat, lng } = req.body;
        
        await db.query(
            'UPDATE drivers SET current_lat = $1, current_lng = $2 WHERE id = $3',
            [lat, lng, driverId]
        );
        
        res.json({ success: true, message: 'Location updated' });
    } catch (error) {
        console.error('Error updating driver location:', error);
        res.status(500).json({ error: 'Failed to update location' });
    }
});

router.get('/drivers', attachAuth, async (req, res) => {
    try {
        if (req.auth?.role === 'admin') {
            const result = await db.query(`
                SELECT 
                    id, name, is_available, is_online, 
                    current_lat, current_lng, speed_kmh, created_at
                FROM drivers 
                ORDER BY id
            `);
            res.json(result.rows);
        } else {
            const result = await db.query('SELECT id, name, current_lat, current_lng FROM drivers WHERE is_available = true AND is_online = true');
            res.json(result.rows);
        }
    } catch (error) {
        console.error('Error fetching drivers:', error);
        res.status(500).json({ error: 'Failed to fetch drivers' });
    }
});

router.get('/drivers/available', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT id, name, current_lat, current_lng, is_available, speed_kmh 
            FROM drivers 
            WHERE is_available = true AND is_online = true
            ORDER BY id
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching available drivers:', error);
        res.status(500).json({ error: 'Failed to fetch available drivers' });
    }
});

router.get('/drivers/admin/all', requireAdmin, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                d.*,
                ST_Y(d.original_location::geometry) as original_lat,
                ST_X(d.original_location::geometry) as original_lng,
                COUNT(del.id) as active_orders
            FROM drivers d
            LEFT JOIN deliveries del ON d.id = del.driver_id 
                AND del.status NOT IN ('completed', 'cancelled')
            GROUP BY d.id
            ORDER BY d.id
        `);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching all drivers:', error);
        res.status(500).json({ error: 'Failed to fetch all drivers' });
    }
});

router.get('/active', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                d.*,
                dr.name as driver_name,
                dr.current_lat,
                dr.current_lng,
                dr.speed_kmh
            FROM deliveries d
            LEFT JOIN drivers dr ON d.driver_id = dr.id
            WHERE d.status NOT IN ('completed', 'cancelled')
            ORDER BY d.driver_id, d.id
        `);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching active deliveries:', error);
        res.status(500).json({ error: 'Failed to fetch active deliveries' });
    }
});

router.post('/cleanup-for-shutdown', requireAdmin, async (req, res) => {
    try {
        console.log('🧹 Cleaning up delivery system for shutdown...');
        
        await db.query(`
            UPDATE drivers 
            SET is_available = true, 
                current_lat = ST_Y(original_location::geometry),
                current_lng = ST_X(original_location::geometry)
        `);
        
        await db.query(`
            UPDATE deliveries 
            SET status = 'completed', delivered_at = CURRENT_TIMESTAMP 
            WHERE status NOT IN ('completed', 'cancelled')
        `);
        
        console.log('✅ Delivery system cleanup completed');
        res.json({ message: 'Cleanup completed successfully' });
    } catch (error) {
        console.error('Error during cleanup:', error);
        res.status(500).json({ error: 'Cleanup failed' });
    }
});

router.get('/health', async (req, res) => {
    try {
        const driversCount = await db.query('SELECT COUNT(*) as count FROM drivers WHERE is_online = true');
        const activeDeliveries = await db.query('SELECT COUNT(*) as count FROM deliveries WHERE status NOT IN (\'completed\', \'cancelled\')');
        
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            drivers: {
                online: parseInt(driversCount.rows[0].count)
            },
            deliveries: {
                active: parseInt(activeDeliveries.rows[0].count)
            },
            note: 'Driver assignment is now handled by dedicated microservice on port 3002'
        });
    } catch (error) {
        console.error('Health check failed:', error);
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

function stopDriverStatusMonitoring() {}

async function cleanup() {
  console.log('🧹 Cleaning up delivery service...');
  stopDriverStatusMonitoring();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

module.exports = router;
module.exports.stopDriverStatusMonitoring = stopDriverStatusMonitoring;
