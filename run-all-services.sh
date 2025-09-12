#!/bin/bash

echo "🚀 Quick Start - Local Life Optimized Services"
echo ""

# Function to reset drivers gracefully
reset_drivers() {
    echo "🔄 Resetting all drivers to available status..."
    
    # Use the existing cleanup script
    cd backend
    if [ -f "cleanup_stuck_deliveries.js" ]; then
        echo "  📊 Running cleanup script..."
        if node cleanup_stuck_deliveries.js > /dev/null 2>&1; then
            echo "  ✅ Drivers reset successfully"
        else
            echo "  ⚠️  Could not reset drivers (cleanup script failed)"
        fi
    else
        echo "  ⚠️  Cleanup script not found"
    fi
    cd ..
}

# Function to kill background processes on exit
cleanup() {
    echo ""
    echo "🛑 Stopping all services..."
    kill $(jobs -p) 2>/dev/null
    pkill -f "npm start" 2>/dev/null
    pkill -f "node.*server.js" 2>/dev/null
    pkill -f "node.*index.js" 2>/dev/null
    
    # Reset drivers when stopping
    reset_drivers
    
    exit 0
}

trap cleanup SIGINT SIGTERM

# Check for existing processes and kill them
echo "🔧 Clearing existing processes..."
lsof -ti :3000 | xargs -r kill -9 2>/dev/null
lsof -ti :3001 | xargs -r kill -9 2>/dev/null  
lsof -ti :3002 | xargs -r kill -9 2>/dev/null
sleep 2

echo "📡 Starting Driver Assignment Service (port 3002)..."
cd driver-assignment-service
npm start > /dev/null 2>&1 &
cd ..

echo "🌐 Starting Backend Service (port 3001)..."
cd backend  
npm start > /dev/null 2>&1 &
cd ..

echo "🎨 Starting Frontend Service (port 3000)..."
cd frontend
BROWSER=none npm start > /dev/null 2>&1 &
cd ..

echo ""
echo "⏳ Services starting up (waiting 10 seconds)..."
sleep 10

echo ""
echo "🎉 Services should be running at:"
echo "  Frontend:         http://localhost:3000"
echo "  Backend:          http://localhost:3001" 
echo "  Driver Service:   http://localhost:3002"
echo ""
echo "📊 Quick health check:"

# Quick health checks
if curl -s http://localhost:3002/health > /dev/null 2>&1; then
    echo "  🚗 Driver Assignment: ✅ Running"
else
    echo "  🚗 Driver Assignment: ❌ Not responding"
fi

if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo "  🌐 Backend: ✅ Running"  
else
    echo "  🌐 Backend: ❌ Not responding"
fi

if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "  🎨 Frontend: ✅ Running"
else
    echo "  🎨 Frontend: ❌ Still starting..."
fi

echo ""

# Reset drivers after services are running
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    reset_drivers
else
    echo "⚠️  Backend not ready, skipping driver reset"
fi

echo ""
echo "Press Ctrl+C to stop all services"

# Wait for background processes
wait 