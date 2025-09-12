-- Enhanced Multi-Order Delivery System
-- Migration 012: Support for multiple orders per driver with route optimization

-- Add route management fields to drivers table
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS max_concurrent_orders INTEGER DEFAULT 3;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS current_route JSONB DEFAULT '[]'::jsonb;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS route_optimized_at TIMESTAMP;

-- Add route order and priority to deliveries table
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS route_order INTEGER DEFAULT 0;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS priority_score DECIMAL(10,2) DEFAULT 0;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS pickup_eta TIMESTAMP;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS delivery_eta TIMESTAMP;

-- Add delivery stops tracking table for complex routes
CREATE TABLE IF NOT EXISTS delivery_stops (
    id SERIAL PRIMARY KEY,
    delivery_id INTEGER REFERENCES deliveries(id) ON DELETE CASCADE,
    stop_type VARCHAR(20) NOT NULL CHECK (stop_type IN ('pickup', 'delivery')),
    location JSONB NOT NULL,
    address TEXT,
    planned_arrival TIMESTAMP,
    actual_arrival TIMESTAMP,
    completed_at TIMESTAMP,
    stop_order INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for route optimization queries
CREATE INDEX IF NOT EXISTS idx_drivers_route ON drivers USING GIN(current_route);
CREATE INDEX IF NOT EXISTS idx_deliveries_route_order ON deliveries(driver_id, route_order);
CREATE INDEX IF NOT EXISTS idx_delivery_stops_order ON delivery_stops(delivery_id, stop_order);
CREATE INDEX IF NOT EXISTS idx_delivery_stops_type ON delivery_stops(stop_type);

-- Update existing drivers with enhanced capabilities
UPDATE drivers SET 
    max_concurrent_orders = 3,
    current_route = '[]'::jsonb
WHERE max_concurrent_orders IS NULL;

-- Add constraint to ensure route order is unique per driver
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_driver_route_order 
ON deliveries(driver_id, route_order) 
WHERE route_order > 0 AND status NOT IN ('completed', 'cancelled');

-- Function to calculate driver utilization score
CREATE OR REPLACE FUNCTION calculate_driver_utilization(driver_id_param INTEGER)
RETURNS DECIMAL(10,2) AS $$
DECLARE
    active_orders INTEGER;
    max_orders INTEGER;
BEGIN
    SELECT COUNT(*), d.max_concurrent_orders 
    INTO active_orders, max_orders
    FROM deliveries del
    JOIN drivers d ON d.id = driver_id_param
    WHERE del.driver_id = driver_id_param 
    AND del.status NOT IN ('completed', 'cancelled')
    GROUP BY d.max_concurrent_orders;
    
    IF max_orders = 0 OR max_orders IS NULL THEN
        RETURN 1.0;
    END IF;
    
    RETURN COALESCE(active_orders::DECIMAL / max_orders::DECIMAL, 0.0);
END;
$$ LANGUAGE plpgsql;

-- Function to get available drivers for new orders
CREATE OR REPLACE FUNCTION get_available_drivers_for_assignment()
RETURNS TABLE (
    driver_id INTEGER,
    driver_name VARCHAR(100),
    current_lat DECIMAL(10,8),
    current_lng DECIMAL(11,8),
    max_concurrent_orders INTEGER,
    active_orders INTEGER,
    utilization_score DECIMAL(10,2),
    speed_kmh INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.name,
        d.current_lat,
        d.current_lng,
        d.max_concurrent_orders,
        COALESCE(active.order_count, 0) as active_orders,
        calculate_driver_utilization(d.id) as utilization_score,
        d.speed_kmh
    FROM drivers d
    LEFT JOIN (
        SELECT 
            del.driver_id, 
            COUNT(*)::INTEGER as order_count
        FROM deliveries del
        WHERE del.status NOT IN ('completed', 'cancelled')
        GROUP BY del.driver_id
    ) active ON d.id = active.driver_id
    WHERE d.is_online = true
    AND COALESCE(active.order_count, 0) < 3
    ORDER BY utilization_score ASC, d.id;
END;
$$ LANGUAGE plpgsql; 