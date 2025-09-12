const { Pool } = require('pg');
require('dotenv').config();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function cleanupStuckDeliveries() {
  const client = await pool.connect();
  
  try {
    console.log('🧹 Starting cleanup of stuck deliveries...');
    
    // Begin transaction
    await client.query('BEGIN');
    
    // 1. Find all stuck deliveries (not delivered or cancelled)
    const stuckDeliveries = await client.query(`
      SELECT d.id, d.status, d.driver_id, dr.name, dr.is_available, dr.is_online
      FROM deliveries d 
      JOIN drivers dr ON d.driver_id = dr.id 
      WHERE d.status NOT IN ('delivered', 'cancelled')
      ORDER BY d.id
    `);
    
    console.log(`🔍 Found ${stuckDeliveries.rows.length} stuck deliveries:`);
    stuckDeliveries.rows.forEach(delivery => {
      console.log(`  - Delivery ${delivery.id}: ${delivery.status} (Driver: ${delivery.name})`);
    });
    
    if (stuckDeliveries.rows.length > 0) {
      // 2. Cancel all stuck deliveries
      await client.query(`
        UPDATE deliveries 
        SET status = 'cancelled' 
        WHERE status NOT IN ('delivered', 'cancelled')
      `);
      
      console.log('✅ Cancelled all stuck deliveries');
      
      // 3. Reset all drivers to available and online
      await client.query(`
        UPDATE drivers 
        SET is_available = true, is_online = true
      `);
      
      console.log('✅ Reset all drivers to available and online');
      
      // 4. Reset all driver locations to their original positions
      await client.query(`
        UPDATE drivers 
        SET current_lat = ST_Y(original_location), 
            current_lng = ST_X(original_location)
        WHERE original_location IS NOT NULL
      `);
      
      console.log('✅ Reset all driver locations to original positions');
      
      // 5. Update any orders that might be stuck in processing
      await client.query(`
        UPDATE orders 
        SET status = 'pending' 
        WHERE status IN ('processing', 'assigned', 'in_transit')
      `);
      
      console.log('✅ Reset stuck orders to pending status');
    } else {
      console.log('✅ No stuck deliveries found - database is clean');
    }
    
    // 6. Verify the cleanup
    const verifyQuery = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM deliveries WHERE status NOT IN ('delivered', 'cancelled')) as stuck_deliveries,
        (SELECT COUNT(*) FROM drivers WHERE is_available = false OR is_online = false) as unavailable_drivers,
        (SELECT COUNT(*) FROM orders WHERE status IN ('processing', 'assigned')) as stuck_orders
    `);
    
    const verification = verifyQuery.rows[0];
    console.log('\n📊 Cleanup verification:');
    console.log(`  - Stuck deliveries remaining: ${verification.stuck_deliveries}`);
    console.log(`  - Unavailable drivers remaining: ${verification.unavailable_drivers}`);
    console.log(`  - Stuck orders remaining: ${verification.stuck_orders}`);
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('\n🎉 Cleanup completed successfully!');
    console.log('💡 You can now restart the servers and the categories should load properly.');
    
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run cleanup
cleanupStuckDeliveries()
  .then(() => {
    console.log('\n✅ Cleanup script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Cleanup script failed:', error);
    process.exit(1);
  }); 