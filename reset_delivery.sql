-- Reset stuck delivery for David Kim (driver_id 5)
-- Step 1: Delete the stuck delivery record
DELETE FROM deliveries WHERE id = 1;

-- Step 2: Reset David Kim to his original location (Mississauga)
UPDATE drivers 
SET current_lat = 43.6565, 
    current_lng = -79.3990,
    is_available = true 
WHERE id = 5;

-- Step 3: Update the order status to cancelled (optional)
UPDATE orders 
SET status = 'cancelled',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 19;

-- Step 4: Verify the reset worked
SELECT 
    d.id,
    d.name,
    d.current_lat,
    d.current_lng,
    d.is_available,
    d.is_online,
    ST_Y(d.original_location) as original_lat,
    ST_X(d.original_location) as original_lng
FROM drivers d 
WHERE d.id = 5;

-- Step 5: Check if there are any other active deliveries
SELECT 
    del.id,
    del.order_id,
    del.driver_id,
    del.status,
    dr.name as driver_name
FROM deliveries del
JOIN drivers dr ON del.driver_id = dr.id
WHERE del.status NOT IN ('delivered', 'cancelled');

-- Step 6: Check the cancelled order
SELECT id, status, total_amount, created_at FROM orders WHERE id = 19; 