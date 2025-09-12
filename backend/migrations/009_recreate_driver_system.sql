-- Recreate Driver System with Simplified Structure
-- Migration 009: Complete driver system rebuild

-- Drop existing tables
DROP TABLE IF EXISTS deliveries CASCADE;
DROP TABLE IF EXISTS drivers CASCADE;

-- Create simplified drivers table
CREATE TABLE drivers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    vehicle_type VARCHAR(50) DEFAULT 'car',
    license_plate VARCHAR(20) NOT NULL,
    current_lat DECIMAL(10, 8) NOT NULL,
    current_lng DECIMAL(11, 8) NOT NULL,
    is_available BOOLEAN DEFAULT true,
    is_online BOOLEAN DEFAULT true,
    speed_kmh INTEGER DEFAULT 50,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create simplified deliveries table
CREATE TABLE deliveries (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    driver_id INTEGER REFERENCES drivers(id),
    status VARCHAR(50) DEFAULT 'pending',
    -- Locations as JSON for simplicity
    restaurant_location JSONB,
    customer_location JSONB,
    -- Tracking data
    assigned_at TIMESTAMP,
    started_at TIMESTAMP,
    arrived_at_restaurant_at TIMESTAMP,
    picked_up_at TIMESTAMP,
    delivered_at TIMESTAMP,
    estimated_delivery_time INTEGER, -- minutes
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert test drivers with Toronto locations
INSERT INTO drivers (name, phone, license_plate, current_lat, current_lng) VALUES
('Alex Thompson', '+1-416-555-0101', 'ABC-123', 43.6532, -79.3832),    -- Downtown Toronto
('Sarah Chen', '+1-416-555-0102', 'DEF-456', 43.6426, -79.3871),        -- Scarborough
('Mike Rodriguez', '+1-416-555-0103', 'GHI-789', 43.6629, -79.3957),    -- North York
('Emma Wilson', '+1-416-555-0104', 'JKL-012', 43.6481, -79.3762),       -- Etobicoke
('David Kim', '+1-416-555-0105', 'MNO-345', 43.6565, -79.3990);         -- Mississauga

-- Create indexes for performance
CREATE INDEX idx_drivers_location ON drivers(current_lat, current_lng);
CREATE INDEX idx_drivers_available ON drivers(is_available, is_online);
CREATE INDEX idx_deliveries_status ON deliveries(status);
CREATE INDEX idx_deliveries_driver ON deliveries(driver_id);
CREATE INDEX idx_deliveries_order ON deliveries(order_id);

-- Update trigger for timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deliveries_updated_at BEFORE UPDATE ON deliveries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 