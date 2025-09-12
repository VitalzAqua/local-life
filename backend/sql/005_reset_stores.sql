-- Delete all existing orders and reservations first to handle foreign key constraints
DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM reservations;

-- Delete all existing store data
DELETE FROM stores; 