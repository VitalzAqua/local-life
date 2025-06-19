-- Create drivers table
CREATE TABLE drivers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    age INTEGER NOT NULL,
    car TEXT NOT NULL,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create deliveries table
CREATE TABLE deliveries (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    driver_id INTEGER REFERENCES drivers(id),
    order_type TEXT NOT NULL CHECK (order_type IN ('eat_in', 'delivery')),
    customer_location TEXT, -- For delivery orders
    estimated_completion_time TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample drivers
INSERT INTO drivers (name, age, car, is_available) VALUES
('John Smith', 28, 'Honda Civic', true),
('Sarah Johnson', 32, 'Toyota Corolla', true),
('Mike Chen', 25, 'Nissan Sentra', true),
('Emily Davis', 29, 'Ford Focus', true),
('Alex Brown', 31, 'Mazda 3', true);

-- Create indexes for better performance
CREATE INDEX idx_deliveries_order_id ON deliveries(order_id);
CREATE INDEX idx_deliveries_driver_id ON deliveries(driver_id);
CREATE INDEX idx_drivers_available ON drivers(is_available); 