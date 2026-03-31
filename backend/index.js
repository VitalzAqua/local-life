const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { SERVER_CONFIG } = require('./config/constants');
const { db } = require('./db');

const app = express();

const resolveRequestOrigin = (req) => {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = forwardedProto ? String(forwardedProto).split(',')[0].trim() : req.protocol;
  const host = req.get('host');
  return host ? `${protocol}://${host}` : null;
};

const corsOptionsDelegate = (req, callback) => {
  const origin = req.header('Origin');

  // Allow requests with no Origin header such as health checks, curl, or
  // server-to-server traffic.
  if (!origin) {
    return callback(null, { origin: true, credentials: true });
  }

  if (SERVER_CONFIG.NODE_ENV === 'development' && origin.includes('localhost')) {
    return callback(null, { origin: true, credentials: true });
  }

  if (SERVER_CONFIG.CORS_ORIGINS.includes(origin)) {
    return callback(null, { origin: true, credentials: true });
  }

  // If no explicit CORS origin is configured, allow same-origin browser
  // requests so a deployed frontend and backend can live on the same host.
  const sameOrigin = resolveRequestOrigin(req);
  if (!SERVER_CONFIG.CORS_ORIGINS.length && sameOrigin && origin === sameOrigin) {
    return callback(null, { origin: true, credentials: true });
  }

  return callback(new Error('Not allowed by CORS'));
};

app.use(cors(corsOptionsDelegate));

app.use((req, res, next) => {
  req.setTimeout(25000, () => {
    console.log(`⏱️ Request timeout: ${req.method} ${req.url}`);
    if (!res.headersSent) {
      res.status(408).json({ 
        error: 'Request timeout',
        message: 'The request took too long to process'
      });
    }
  });
  next();
});

app.use((req, res, next) => {
  res.on('timeout', () => {
    console.log(`⏱️ Response timeout: ${req.method} ${req.url}`);
  });
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const usersRouter = require('./routes/users');
const ordersRouter = require('./routes/orders');
const reservationsRouter = require('./routes/reservations');
const nearbyRouter = require('./routes/nearby');
const deliveryRouter = require('./routes/delivery');
const savedLocationsRouter = require('./routes/savedLocations');
const searchRouter = require('./routes/search');

const gracefulShutdown = async (signal) => {
  console.log(`\n🔄 Received ${signal}. Starting graceful shutdown...`);
  
  try {
    console.log('🚫 Stopping server from accepting new connections...');
    console.log('🧹 Cleaning up active deliveries...');
    await cleanupActiveDeliveries();
    console.log('🚗 Resetting all drivers to available state...');
    await resetAllDrivers();
    console.log('🗄️ Closing database connections...');
    await db.end();
    
    console.log('✅ Graceful shutdown completed successfully');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
};

const cleanupActiveDeliveries = async () => {
  try {
    const activeDeliveries = await db.query(`
      SELECT d.id, d.order_id, d.status, d.driver_id
      FROM deliveries d
      WHERE d.status IN ('assigned', 'started', 'arrived_at_restaurant', 'picked_up', 'returning')
    `);
    
    if (activeDeliveries.rows.length === 0) {
      console.log('  ℹ️ No active deliveries to clean up');
      return;
    }
    
    console.log(`  🧹 Found ${activeDeliveries.rows.length} active deliveries to clean up`);
    
    const affectedOrders = await db.query(`
      SELECT DISTINCT order_id FROM deliveries
      WHERE status IN ('assigned', 'started', 'arrived_at_restaurant', 'picked_up', 'returning')
    `);
    const orderIds = affectedOrders.rows.map(r => r.order_id);

    await db.query(`
      UPDATE deliveries 
      SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE status IN ('assigned', 'started', 'arrived_at_restaurant', 'picked_up', 'returning')
    `);

    if (orderIds.length > 0) {
      await db.query(`
        UPDATE orders SET status = 'pending', updated_at = CURRENT_TIMESTAMP
        WHERE id = ANY($1)
      `, [orderIds]);
    }
    
    console.log(`  ✅ Cleaned up ${activeDeliveries.rows.length} active deliveries`);
    
  } catch (error) {
    console.error('  ❌ Error cleaning up active deliveries:', error);
    throw error;
  }
};

const resetAllDrivers = async () => {
  try {
    const result = await db.query(`
      UPDATE drivers 
      SET is_available = true, 
          is_online = true,
          current_lat = ST_Y(original_location::geometry),
          current_lng = ST_X(original_location::geometry),
          updated_at = CURRENT_TIMESTAMP
      WHERE original_location IS NOT NULL
    `);
    
    console.log(`  ✅ Reset ${result.rowCount} drivers to home positions`);
    
  } catch (error) {
    console.error('  ❌ Error resetting drivers:', error);
    throw error;
  }
};

const startupRecovery = async () => {
  console.log('🔄 Running startup recovery...');
  
  try {
    console.log('🔍 Testing database connection...');
    await testDatabaseConnection();
    await cleanupActiveDeliveries();
    await resetAllDrivers();
    
    console.log('✅ Startup recovery completed successfully');
    
  } catch (error) {
    console.error('❌ Error during startup recovery:', error);
  }
};

const testDatabaseConnection = async () => {
  try {
    const result = await db.query('SELECT NOW() as current_time, COUNT(*) as store_count FROM stores');
    console.log(`✅ Database connected successfully. Server time: ${result.rows[0].current_time}, Store count: ${result.rows[0].store_count}`);
    
    const categoriesTest = await db.query('SELECT DISTINCT category FROM stores WHERE category IS NOT NULL ORDER BY category LIMIT 5');
    console.log(`✅ Categories query test passed. Sample categories: ${categoriesTest.rows.map(r => r.category).join(', ')}`);
    
  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    throw error;
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT'));

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

startupRecovery();

app.use('/api/users', usersRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/reservations', reservationsRouter);
app.use('/api/nearby', nearbyRouter);
app.use('/api/search', searchRouter);
app.use('/delivery', deliveryRouter);
app.use('/api/saved-locations', savedLocationsRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'local-life-backend' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'local-life-backend' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(`❌ Global error handler: ${req.method} ${req.url}`, err);

  if (res.headersSent) {
    return next(err);
  }

  if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
    return res.status(503).json({
      error: 'Database connection lost',
      message: 'Please try again in a moment'
    });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation error',
      message: err.message
    });
  }

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `${req.method} ${req.originalUrl} does not exist`,
    timestamp: new Date().toISOString()
  });
});

const server = app.listen(SERVER_CONFIG.PORT, () => {
  console.log(`🚀 Server running on port ${SERVER_CONFIG.PORT}`);
  console.log(`📍 Environment: ${SERVER_CONFIG.NODE_ENV}`);
  console.log(
    `🌐 CORS origins: ${SERVER_CONFIG.CORS_ORIGINS.length ? SERVER_CONFIG.CORS_ORIGINS.join(', ') : 'same-origin fallback'}`
  );

  setTimeout(() => {
    startMovementSimulation();
  }, 3000);
});

// Delivery movement simulation
function logDeliveryTransition(driverName, orderId, deliveryId, fromStatus, toStatus, detail = '') {
  const oid = orderId != null ? `#${orderId}` : 'n/a';
  const extra = detail ? ` · ${detail}` : '';
  console.log(`📦 [sim] ${driverName} · order ${oid} · delivery ${deliveryId} · ${fromStatus} → ${toStatus}${extra}`);
}

function startMovementSimulation() {
  console.log('🎮 Starting automatic movement simulation...');

  const simulateMovement = async () => {
    try {
      const activeDrivers = await db.query(`
        SELECT DISTINCT
          d.id as driver_id, d.name as driver_name,
          d.current_lat, d.current_lng, d.speed_kmh,
          ST_Y(d.original_location::geometry) as original_lat,
          ST_X(d.original_location::geometry) as original_lng,
          del.id as delivery_id, del.order_id, del.status as delivery_status,
          del.restaurant_location, del.customer_location,
          del.arrived_at_restaurant_at
        FROM drivers d
        INNER JOIN deliveries del ON d.id = del.driver_id
        WHERE del.status IN ('assigned','started','arrived_at_restaurant','picked_up','returning')
      `);

      if (activeDrivers.rows.length > 0) {
        const driverIds = [...new Set(activeDrivers.rows.map(d => d.driver_id))];
        await db.query(
          'UPDATE drivers SET is_available = false, updated_at = NOW() WHERE id = ANY($1)',
          [driverIds]
        );
      }

      for (const driver of activeDrivers.rows) {
        try {
          const currentLat = parseFloat(driver.current_lat);
          const currentLng = parseFloat(driver.current_lng);
          const originalLat = parseFloat(driver.original_lat);
          const originalLng = parseFloat(driver.original_lng);
          const speed = driver.speed_kmh || 40;

          let restaurantLoc = driver.restaurant_location;
          let customerLoc = driver.customer_location || { lat: 43.6532, lng: -79.3832 };
          if (typeof restaurantLoc === 'string') restaurantLoc = JSON.parse(restaurantLoc);
          if (typeof customerLoc === 'string') customerLoc = JSON.parse(customerLoc);

          let targetLat, targetLng;

          switch (driver.delivery_status) {
            case 'assigned':
              targetLat = restaurantLoc.lat ?? restaurantLoc.latitude;
              targetLng = restaurantLoc.lng ?? restaurantLoc.longitude;
              await db.query(
                `UPDATE deliveries SET status = 'started', started_at = NOW() WHERE id = $1`,
                [driver.delivery_id]
              );
              logDeliveryTransition(
                driver.driver_name,
                driver.order_id,
                driver.delivery_id,
                'assigned',
                'started',
                'en route to restaurant'
              );
              break;
            case 'started':
              targetLat = restaurantLoc.lat ?? restaurantLoc.latitude;
              targetLng = restaurantLoc.lng ?? restaurantLoc.longitude;
              break;
            case 'arrived_at_restaurant': {
              const waitMs = 30000;
              if (Date.now() - new Date(driver.arrived_at_restaurant_at).getTime() > waitMs) {
                targetLat = customerLoc.lat ?? customerLoc.latitude;
                targetLng = customerLoc.lng ?? customerLoc.longitude;
                await db.query(
                  `UPDATE deliveries SET status = 'picked_up', picked_up_at = NOW() WHERE id = $1`,
                  [driver.delivery_id]
                );
                logDeliveryTransition(
                  driver.driver_name,
                  driver.order_id,
                  driver.delivery_id,
                  'arrived_at_restaurant',
                  'picked_up',
                  'heading to customer'
                );
              }
              continue;
            }
            case 'picked_up':
              targetLat = customerLoc.lat ?? customerLoc.latitude;
              targetLng = customerLoc.lng ?? customerLoc.longitude;
              break;
            case 'returning':
              targetLat = originalLat;
              targetLng = originalLng;
              break;
            default:
              continue;
          }

          if (!targetLat || !targetLng || isNaN(targetLat) || isNaN(targetLng)) continue;

          const latDiff = targetLat - currentLat;
          const lngDiff = targetLng - currentLng;
          const dist = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);

          if (dist > 0.001) {
            const step = 0.0005 * (speed / 40);
            const newLat = currentLat + (latDiff / dist) * step;
            const newLng = currentLng + (lngDiff / dist) * step;
            await db.query(
              'UPDATE drivers SET current_lat = $1, current_lng = $2, updated_at = NOW() WHERE id = $3',
              [newLat, newLng, driver.driver_id]
            );
          } else {
            switch (driver.delivery_status) {
              case 'started':
                await db.query(
                  `UPDATE deliveries SET status = 'arrived_at_restaurant', arrived_at_restaurant_at = NOW() WHERE id = $1`,
                  [driver.delivery_id]
                );
                logDeliveryTransition(
                  driver.driver_name,
                  driver.order_id,
                  driver.delivery_id,
                  'started',
                  'arrived_at_restaurant',
                  'at restaurant (30s wait before pickup)'
                );
                break;
              case 'picked_up':
                await db.query(
                  `UPDATE deliveries SET status = 'returning', delivered_at = NOW() WHERE id = $1`,
                  [driver.delivery_id]
                );
                logDeliveryTransition(
                  driver.driver_name,
                  driver.order_id,
                  driver.delivery_id,
                  'picked_up',
                  'returning',
                  'delivered — heading home'
                );
                break;
              case 'returning':
                await db.query(
                  `UPDATE deliveries SET status = 'completed', completed_at = NOW() WHERE id = $1`,
                  [driver.delivery_id]
                );
                await db.query(
                  'UPDATE drivers SET is_available = true, current_lat = $1, current_lng = $2, updated_at = NOW() WHERE id = $3',
                  [originalLat, originalLng, driver.driver_id]
                );
                logDeliveryTransition(
                  driver.driver_name,
                  driver.order_id,
                  driver.delivery_id,
                  'returning',
                  'completed',
                  'driver available again'
                );
                break;
            }
          }
        } catch (driverErr) {
          console.error(`Error simulating driver ${driver.driver_name}:`, driverErr.message);
        }
      }
    } catch (err) {
      console.error('❌ Movement simulation error:', err.message);
    }
  };

  setInterval(simulateMovement, 3000);
}

server.on('error', (error) => {
  console.error('Server error:', error);
});

module.exports = app;
