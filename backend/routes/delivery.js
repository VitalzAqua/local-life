const express = require('express');
const router = express.Router();
// Use the global db object created in index.js
const db = global.db;

// Admin password for viewing all drivers
const ADMIN_PASSWORD = '780523';

// Simple distance calculation function (Haversine formula)
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

// Update driver location
router.post('/drivers/:driverId/location', async (req, res) => {
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

// Get drivers (with admin password protection for full details)
router.get('/drivers', async (req, res) => {
    try {
        const { password } = req.query;
        
        if (password === ADMIN_PASSWORD) {
            // Return all drivers with full details
            const result = await db.query(`
                SELECT 
                    id, name, is_available, is_online, 
                    current_lat, current_lng, speed_kmh, created_at
                FROM drivers 
                ORDER BY id
            `);
            res.json(result.rows);
        } else {
            // Return only available drivers without admin password
            const result = await db.query('SELECT id, name, current_lat, current_lng FROM drivers WHERE is_available = true AND is_online = true');
            res.json(result.rows);
        }
    } catch (error) {
        console.error('Error fetching drivers:', error);
        res.status(500).json({ error: 'Failed to fetch drivers' });
    }
});

// Get available drivers only (public endpoint)
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

// Get all drivers with full details (admin endpoint)
router.get('/drivers/admin/all', async (req, res) => {
    try {
        const { password } = req.query;
        
        if (password !== ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Admin access required' });
        }

        const result = await db.query(`
            SELECT 
                d.*,
                ST_Y(d.original_location) as original_lat,
                ST_X(d.original_location) as original_lng,
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

// Get active deliveries
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

// Simulate driver movement with proper delivery workflow
router.post('/simulate-movement', async (req, res) => {
  try {
    // Get all active deliveries with driver info and delivery details
    const activeDrivers = await db.query(`
      SELECT DISTINCT 
        d.id as driver_id, 
        d.name as driver_name, 
        d.current_lat, 
        d.current_lng, 
        d.speed_kmh,
        ST_Y(d.original_location) as original_lat,
        ST_X(d.original_location) as original_lng,
        del.id as delivery_id,
        del.status as delivery_status,
        del.restaurant_location,
        del.customer_location,
        del.assigned_at,
        del.started_at,
        del.arrived_at_restaurant_at,
        del.picked_up_at
      FROM drivers d
      INNER JOIN deliveries del ON d.id = del.driver_id 
      WHERE del.status IN ('assigned', 'started', 'arrived_at_restaurant', 'picked_up', 'returning')
    `);

    console.log(`🎮 Movement simulation for ${activeDrivers.rows.length} drivers`);

    // Ensure all drivers with active deliveries are marked as unavailable
    if (activeDrivers.rows.length > 0) {
      const driverIds = activeDrivers.rows.map(d => d.driver_id);
      await db.query(`
        UPDATE drivers 
        SET is_available = false, updated_at = NOW() 
        WHERE id = ANY($1)
      `, [driverIds]);
      console.log(`🔄 Marked ${driverIds.length} drivers as unavailable`);
    }

    for (const driver of activeDrivers.rows) {
      try {
        // Parse coordinates as floats
        const currentLat = parseFloat(driver.current_lat);
        const currentLng = parseFloat(driver.current_lng);
        const originalLat = parseFloat(driver.original_lat);
        const originalLng = parseFloat(driver.original_lng);
        const speed = driver.speed_kmh || 50;
        
        // Parse locations (they're stored as JSON strings)
        let restaurantLoc, customerLoc;
        try {
          restaurantLoc = typeof driver.restaurant_location === 'string' 
            ? JSON.parse(driver.restaurant_location) 
            : driver.restaurant_location;
          customerLoc = typeof driver.customer_location === 'string'
            ? JSON.parse(driver.customer_location)
            : (driver.customer_location || { lat: 43.6532, lng: -79.3832 });
        } catch (parseError) {
          console.error(`❌ Error parsing locations for driver ${driver.driver_name}:`, parseError);
          console.error(`Restaurant location: ${driver.restaurant_location}`);
          console.error(`Customer location: ${driver.customer_location}`);
          continue;
        }
        
        let targetLat, targetLng, nextStatus;
        
        // Determine target based on delivery status
        switch (driver.delivery_status) {
          case 'assigned':
            // Just assigned, start traveling to restaurant
            targetLat = restaurantLoc.latitude || restaurantLoc.lat;
            targetLng = restaurantLoc.longitude || restaurantLoc.lng;
            nextStatus = 'started';
            
            // Update to started status immediately
            await db.query(`
              UPDATE deliveries 
              SET status = 'started', started_at = NOW()
              WHERE id = $1
            `, [driver.delivery_id]);
            
            console.log(`🚗 Driver ${driver.driver_name} started traveling to restaurant`);
            break;
            
          case 'started':
            // Traveling to restaurant
            targetLat = restaurantLoc.latitude || restaurantLoc.lat;
            targetLng = restaurantLoc.longitude || restaurantLoc.lng;
            nextStatus = 'arrived_at_restaurant';
            break;
            
          case 'arrived_at_restaurant':
            // Simulate pickup time (30 seconds for testing)
            const pickupTime = 0.5; // 30 seconds
            const arrivedTime = new Date(driver.arrived_at_restaurant_at);
            const pickupDue = new Date(arrivedTime.getTime() + pickupTime * 60000);
            
            if (new Date() > pickupDue) {
              // Pickup complete, start traveling to customer
              targetLat = customerLoc.latitude || customerLoc.lat;
              targetLng = customerLoc.longitude || customerLoc.lng;
              nextStatus = 'picked_up';
              
              await db.query(`
                UPDATE deliveries 
                SET status = 'picked_up', picked_up_at = NOW()
                WHERE id = $1
              `, [driver.delivery_id]);
              
              console.log(`📦 Driver ${driver.driver_name} picked up order, traveling to customer`);
            } else {
              // Still waiting for pickup
              continue;
            }
            break;
            
          case 'picked_up':
            // Traveling to customer
            targetLat = customerLoc.latitude || customerLoc.lat;
            targetLng = customerLoc.longitude || customerLoc.lng;
            nextStatus = 'delivered';
            break;
            
          case 'returning':
            // Returning to base
            targetLat = originalLat;
            targetLng = originalLng;
            nextStatus = 'completed';
            break;
            
          default:
            continue;
        }

        // Validate target coordinates
        if (!targetLat || !targetLng || isNaN(targetLat) || isNaN(targetLng)) {
          console.error(`❌ Invalid target coordinates for driver ${driver.driver_name}: (${targetLat}, ${targetLng})`);
          console.error(`Status: ${driver.delivery_status}, Restaurant: ${JSON.stringify(restaurantLoc)}, Customer: ${JSON.stringify(customerLoc)}`);
          continue;
        }

        // Calculate movement towards target
        const latDiff = targetLat - currentLat;
        const lngDiff = targetLng - currentLng;
        const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
        
        if (distance > 0.001) { // Still moving to target
          // Realistic movement: Slow down movement for longer delivery times
          // This will make deliveries take 5-10 minutes total
          const stepSize = 0.0005 * (speed / 50); // Much smaller steps for realistic timing
          const newLat = currentLat + (latDiff / distance) * stepSize;
          const newLng = currentLng + (lngDiff / distance) * stepSize;

          await db.query(`
            UPDATE drivers 
            SET current_lat = $1, current_lng = $2, updated_at = NOW()
            WHERE id = $3
          `, [newLat, newLng, driver.driver_id]);

          console.log(`🚗 Driver ${driver.driver_name} moving: (${currentLat.toFixed(5)}, ${currentLng.toFixed(5)}) → (${newLat.toFixed(5)}, ${newLng.toFixed(5)})`);

        } else { // Reached target
          // Update delivery status based on current stage
          switch (driver.delivery_status) {
            case 'started':
              await db.query(`
                UPDATE deliveries 
                SET status = 'arrived_at_restaurant', arrived_at_restaurant_at = NOW()
                WHERE id = $1
              `, [driver.delivery_id]);
              console.log(`🏪 Driver ${driver.driver_name} arrived at restaurant`);
              break;
              
            case 'picked_up':
              await db.query(`
                UPDATE deliveries 
                SET status = 'returning', delivered_at = NOW()
                WHERE id = $1
              `, [driver.delivery_id]);
              console.log(`🎯 Driver ${driver.driver_name} delivered order, returning to base`);
              break;
              
            case 'returning':
              // Complete delivery and make driver available
              await db.query(`
                UPDATE deliveries 
                SET status = 'completed'
                WHERE id = $1
              `, [driver.delivery_id]);

              await db.query(`
                UPDATE drivers 
                SET is_available = true, updated_at = NOW()
                WHERE id = $1
              `, [driver.driver_id]);

              console.log(`✅ Driver ${driver.driver_name} completed delivery and returned to base`);
              break;
          }
        }
        
      } catch (driverError) {
        console.error(`Error simulating movement for driver ${driver.driver_name}:`, driverError);
      }
    }

    res.json({ 
      success: true, 
      driversSimulated: activeDrivers.rows.length 
    });

  } catch (error) {
    console.error('Error simulating movement:', error);
    res.status(500).json({ error: 'Failed to simulate movement' });
  }
});

// Cleanup for shutdown
router.post('/cleanup-for-shutdown', async (req, res) => {
    try {
        console.log('🧹 Cleaning up delivery system for shutdown...');
        
        // Mark all drivers as available and return them to base
        await db.query(`
            UPDATE drivers 
            SET is_available = true, 
                current_lat = ST_Y(original_location),
                current_lng = ST_X(original_location)
        `);
        
        // Complete all active deliveries
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

// Health check
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

// Driver status monitoring function
async function logDriverStatus() {
  try {
    const result = await db.query(`
      SELECT 
        d.id,
        d.name,
        d.is_available,
        d.is_online,
        d.current_lat,
        d.current_lng,
        del.id as delivery_id,
        del.status as delivery_status,
        del.assigned_at,
        del.started_at,
        del.arrived_at_restaurant_at,
        del.picked_up_at,
        del.delivered_at,
        o.id as order_id
      FROM drivers d
      LEFT JOIN deliveries del ON d.id = del.driver_id AND del.status IN ('assigned', 'started', 'arrived_at_restaurant', 'picked_up', 'returning')
      LEFT JOIN orders o ON del.order_id = o.id
      WHERE d.is_online = true
      ORDER BY d.id
    `);

    console.log('\n📊 ===== DRIVER STATUS REPORT =====');
    console.log(`🕐 ${new Date().toLocaleTimeString()}`);
    
    for (const driver of result.rows) {
      const coords = `(${parseFloat(driver.current_lat).toFixed(4)}, ${parseFloat(driver.current_lng).toFixed(4)})`;
      const availability = driver.is_available ? '🟢 Available' : '🔴 Busy';
      
      if (driver.delivery_id) {
        // Driver has active delivery
        const timeElapsed = driver.assigned_at ? 
          Math.round((Date.now() - new Date(driver.assigned_at).getTime()) / 1000) : 0;
        
        let statusDetail = '';
        switch (driver.delivery_status) {
          case 'assigned':
            statusDetail = '📋 Just assigned, heading to restaurant';
            break;
          case 'started':
            statusDetail = '🚗 Traveling to restaurant';
            break;
          case 'arrived_at_restaurant':
            const waitTime = driver.arrived_at_restaurant_at ? 
              Math.round((Date.now() - new Date(driver.arrived_at_restaurant_at).getTime()) / 1000) : 0;
            statusDetail = `🏪 At restaurant (waiting ${waitTime}s for pickup)`;
            break;
          case 'picked_up':
            statusDetail = '📦 Delivering to customer';
            break;
          case 'returning':
            statusDetail = '🏠 Returning to base';
            break;
        }
        
        console.log(`  🚗 ${driver.name} ${availability} ${coords}`);
        console.log(`     Order #${driver.order_id} | ${statusDetail} | ${timeElapsed}s elapsed`);
      } else {
        // Driver is available
        console.log(`  🚗 ${driver.name} ${availability} ${coords} | 😴 Waiting for orders`);
      }
    }
    
    console.log('=====================================\n');
    
  } catch (error) {
    console.error('❌ Error getting driver status:', error);
  }
}

// Start driver status monitoring (every 5 seconds)
let statusInterval;
function startDriverStatusMonitoring() {
  console.log('📊 Starting driver status monitoring (every 5 seconds)...');
  statusInterval = setInterval(logDriverStatus, 5000);
  // Log initial status
  setTimeout(logDriverStatus, 1000);
}

// Stop driver status monitoring
function stopDriverStatusMonitoring() {
  if (statusInterval) {
    clearInterval(statusInterval);
    console.log('📊 Driver status monitoring stopped');
  }
}

// Cleanup for shutdown
async function cleanup() {
  console.log('🧹 Cleaning up delivery service...');
  stopDriverStatusMonitoring();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

module.exports = router;
module.exports.startDriverStatusMonitoring = startDriverStatusMonitoring;
module.exports.stopDriverStatusMonitoring = stopDriverStatusMonitoring; 