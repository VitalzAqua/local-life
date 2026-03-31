const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool({
  connectionString: config.database.connectionString,
  ...config.database.pool,
  ssl: (() => {
    const url = config.database.connectionString || '';
    if (url.includes('localhost') || url.includes('127.0.0.1')) return false;
    return { rejectUnauthorized: false };
  })()
});

async function initializeDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Initializing optimized driver assignment database...');
    
    await client.query(`
      ALTER TABLE drivers 
      ADD COLUMN IF NOT EXISTS max_concurrent_orders INTEGER DEFAULT 3,
      ADD COLUMN IF NOT EXISTS speed_kmh INTEGER DEFAULT 40
    `);
    
    await client.query(`
      ALTER TABLE deliveries 
      ADD COLUMN IF NOT EXISTS route_order INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS estimated_delivery_time INTEGER DEFAULT 30
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_deliveries_driver_route 
      ON deliveries(driver_id, route_order) 
      WHERE status NOT IN ('completed', 'cancelled')
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_deliveries_active 
      ON deliveries(driver_id, status) 
      WHERE status NOT IN ('completed', 'cancelled')
    `);
    
    await client.query(`
      CREATE OR REPLACE FUNCTION calculate_driver_total_eta(driver_id_param INTEGER)
      RETURNS INTEGER AS $$
      DECLARE
        total_eta INTEGER;
      BEGIN
        SELECT COALESCE(SUM(estimated_delivery_time), 0)
        INTO total_eta
        FROM deliveries
        WHERE driver_id = driver_id_param 
        AND status NOT IN ('completed', 'cancelled');
        
        RETURN total_eta;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    await client.query(`
      CREATE OR REPLACE FUNCTION get_driver_utilization(driver_id_param INTEGER)
      RETURNS DECIMAL(5,2) AS $$
      DECLARE
        active_orders INTEGER;
        max_orders INTEGER;
      BEGIN
        SELECT 
          COUNT(del.id),
          d.max_concurrent_orders
        INTO active_orders, max_orders
        FROM drivers d
        LEFT JOIN deliveries del ON d.id = del.driver_id 
          AND del.status NOT IN ('completed', 'cancelled')
        WHERE d.id = driver_id_param
        GROUP BY d.max_concurrent_orders;
        
        IF max_orders = 0 OR max_orders IS NULL THEN
          RETURN 1.00;
        END IF;
        
        RETURN COALESCE(active_orders::DECIMAL / max_orders::DECIMAL, 0.00);
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    await client.query(`
      CREATE OR REPLACE FUNCTION get_optimized_drivers_for_assignment()
      RETURNS TABLE (
        driver_id INTEGER,
        driver_name VARCHAR(100),
        current_lat DECIMAL(10,8),
        current_lng DECIMAL(11,8),
        max_concurrent_orders INTEGER,
        active_deliveries INTEGER,
        total_eta_minutes INTEGER,
        utilization_percentage DECIMAL(5,2),
        can_accept_order BOOLEAN
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          d.id,
          d.name,
          d.current_lat,
          d.current_lng,
          d.max_concurrent_orders,
          COALESCE(active.delivery_count, 0)::INTEGER as active_deliveries,
          calculate_driver_total_eta(d.id) as total_eta_minutes,
          get_driver_utilization(d.id) as utilization_percentage,
          (COALESCE(active.delivery_count, 0) < d.max_concurrent_orders 
           AND calculate_driver_total_eta(d.id) < 120) as can_accept_order -- 2 hours = 120 minutes
        FROM drivers d
        LEFT JOIN (
          SELECT 
            del.driver_id, 
            COUNT(*)::INTEGER as delivery_count
          FROM deliveries del
          WHERE del.status NOT IN ('completed', 'cancelled')
          GROUP BY del.driver_id
        ) active ON d.id = active.driver_id
        WHERE d.is_online = true
        ORDER BY utilization_percentage ASC, d.id;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    await client.query(`
      CREATE OR REPLACE FUNCTION update_driver_availability()
      RETURNS TRIGGER AS $$
      BEGIN
        UPDATE drivers 
        SET is_available = (
          SELECT COUNT(*) < max_concurrent_orders
          FROM deliveries 
          WHERE driver_id = COALESCE(NEW.driver_id, OLD.driver_id)
          AND status NOT IN ('completed', 'cancelled')
        )
        WHERE id = COALESCE(NEW.driver_id, OLD.driver_id);
        
        RETURN COALESCE(NEW, OLD);
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    await client.query(`
      DROP TRIGGER IF EXISTS trigger_update_driver_availability ON deliveries;
      CREATE TRIGGER trigger_update_driver_availability
        AFTER INSERT OR UPDATE OR DELETE ON deliveries
        FOR EACH ROW
        EXECUTE FUNCTION update_driver_availability();
    `);
    
    console.log('✅ Database initialized for optimized multi-delivery system');
    
  } catch (error) {
    console.error('🚨 Database initialization error:', error);
    throw error;
  } finally {
    client.release();
  }
}

pool.on('connect', () => {
  console.log('🗄️  Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('🚨 Database connection error:', err);
});

initializeDatabase().catch(console.error);

module.exports = pool; 
