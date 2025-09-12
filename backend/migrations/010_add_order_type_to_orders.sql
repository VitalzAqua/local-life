-- Add order_type column to orders table
-- Migration 010: Add order type tracking to orders

ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type VARCHAR(20) DEFAULT 'eat_in';

-- Update existing orders to have a default order type
UPDATE orders SET order_type = 'eat_in' WHERE order_type IS NULL; 