#!/bin/bash

echo "🔍 Debugging Driver System"
echo "========================="

# Check if backend is running
echo "1. Checking if backend is running..."
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "   ✅ Backend is running"
else
    echo "   ❌ Backend is not running! Please start it with: cd backend && npm start"
    exit 1
fi

# Check database connection
echo "2. Checking database connection..."
if psql -U postgres -d local_life -c "SELECT 1;" > /dev/null 2>&1; then
    echo "   ✅ Database connection is working"
else
    echo "   ❌ Database connection failed! Please check your PostgreSQL setup"
    exit 1
fi

# Check if drivers table exists
echo "3. Checking drivers table..."
if psql -U postgres -d local_life -c "SELECT COUNT(*) FROM drivers;" > /dev/null 2>&1; then
    echo "   ✅ Drivers table exists"
else
    echo "   ❌ Drivers table not found! Please run migrations first"
    exit 1
fi

# Check if drivers have locations
echo "4. Checking driver locations..."
LOCATION_COUNT=$(psql -U postgres -d local_life -t -c "SELECT COUNT(*) FROM drivers WHERE current_lat IS NOT NULL AND current_lng IS NOT NULL;" | xargs)
if [ "$LOCATION_COUNT" -eq "0" ]; then
    echo "   ❌ No driver locations found! Running migration..."
    
    # Run the migration
    echo "   📦 Running driver location migration..."
    cd backend
    psql -U postgres -d local_life -f sql/008_add_driver_locations.sql
    
    if [ $? -eq 0 ]; then
        echo "   ✅ Migration completed successfully"
    else
        echo "   ❌ Migration failed!"
        exit 1
    fi
else
    echo "   ✅ Found $LOCATION_COUNT drivers with locations"
fi

# Test the API endpoint
echo "5. Testing driver API endpoint..."
RESPONSE=$(curl -s http://localhost:3001/api/delivery/drivers/available)
if [ $? -eq 0 ]; then
    echo "   ✅ API endpoint is working"
    echo "   📊 Response: $RESPONSE"
else
    echo "   ❌ API endpoint failed!"
    exit 1
fi

# Show current driver data
echo "6. Current driver data:"
psql -U postgres -d local_life -c "SELECT id, name, current_lat, current_lng, is_available FROM drivers ORDER BY id;"

echo ""
echo "🎉 All checks passed! The system should be working now."
echo "💡 Open the browser console to see detailed logs with emojis:"
echo "   🚀 App initialization logs"
echo "   🚗 Driver service logs"
echo "   🚛 Backend API logs"
echo "   🗺️ Driver tracking map logs" 