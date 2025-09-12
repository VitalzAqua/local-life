# Graceful Shutdown System

## Overview
The graceful shutdown system prevents database inconsistencies when the server is stopped during active deliveries. It automatically cleans up stuck deliveries and resets drivers to prevent the system from getting into an inconsistent state.

## Features

### 1. Automatic Startup Recovery
- Runs every time the server starts
- Cancels any stuck deliveries from previous session
- Resets all drivers to available state at their original locations
- Ensures database consistency on startup

### 2. Enhanced Graceful Shutdown
When the server receives a shutdown signal (Ctrl+C, SIGTERM, etc.), it:
- Cancels all active deliveries
- Resets all drivers to available state
- Moves drivers back to their original locations
- Properly closes database connections
- Exits cleanly without leaving hanging connections

### 3. Timeout Protection
- Automatically cancels deliveries running for more than 30 minutes
- Prevents infinite loops in driver movement simulation
- Warns when deliveries are approaching timeout (25+ minutes)

### 4. Manual Cleanup
- Endpoint: `POST /delivery/cleanup`
- Can be called manually to reset system state
- Useful for debugging or emergency recovery

### 5. Health Monitoring
- Endpoint: `GET /delivery/health`
- Shows system status and database connectivity
- Displays driver availability and active deliveries
- Indicates if system is ready for operation

## API Endpoints

### Health Check
```bash
curl http://localhost:3001/delivery/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "database": "connected",
  "drivers": {
    "total": 5,
    "available": 5,
    "with_original_location": 5
  },
  "active_deliveries": 0,
  "system_ready": true
}
```

### Manual Cleanup
```bash
curl -X POST http://localhost:3001/delivery/cleanup
```

Response:
```json
{
  "success": true,
  "message": "System cleanup completed successfully",
  "deliveries_cleaned": 2,
  "drivers_reset": 3,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## How It Works

### Startup Process
1. Server starts
2. `startupRecovery()` function runs automatically
3. Cleans up any stuck deliveries from previous session
4. Resets all drivers to available state
5. Server is ready to accept requests

### Shutdown Process
1. Server receives shutdown signal (Ctrl+C, SIGTERM, etc.)
2. `gracefulShutdown()` function is triggered
3. Stops accepting new requests
4. Calls `cleanupActiveDeliveries()` to cancel active deliveries
5. Calls `resetAllDrivers()` to reset driver states
6. Closes database connections
7. Exits process cleanly

### During Operation
- Movement simulation checks for stuck deliveries (>30 minutes)
- Automatically cancels them and resets drivers
- Logs warnings for deliveries approaching timeout (>25 minutes)

## Benefits

1. **No More Database Inconsistencies**: Shutting down the server during active deliveries won't leave the database in a bad state
2. **Automatic Recovery**: System automatically recovers on startup
3. **Timeout Protection**: Prevents infinite loops and stuck deliveries
4. **Manual Control**: Can manually reset system state when needed
5. **Health Monitoring**: Easy way to check system status

## Usage

### Normal Operation
Just start and stop the server normally. The graceful shutdown will handle everything automatically.

```bash
# Start server
npm start

# Stop server (Ctrl+C)
# Graceful shutdown will automatically clean up
```

### Emergency Recovery
If something goes wrong, you can manually reset the system:

```bash
# Check system health
curl http://localhost:3001/delivery/health

# Manual cleanup if needed
curl -X POST http://localhost:3001/delivery/cleanup
```

### Development
During development, you can frequently stop and start the server without worrying about database consistency issues.

## Technical Details

### Database Changes
- Uses existing `original_location` column in drivers table
- Updates deliveries to 'cancelled' status
- Resets orders back to 'pending' status
- Resets drivers to available/online state

### Signal Handling
- SIGINT (Ctrl+C)
- SIGTERM (process termination)
- SIGQUIT (quit signal)
- Uncaught exceptions
- Unhandled promise rejections

### Timeout Configuration
- Delivery timeout: 30 minutes
- Warning threshold: 25 minutes
- Movement simulation interval: 5 seconds

## Troubleshooting

### System Not Ready
If `system_ready` is false in health check:
- Some drivers don't have original_location set
- Run: `curl -X POST http://localhost:3001/delivery/cleanup`

### Stuck Deliveries
If deliveries are stuck:
- Check health endpoint for active_deliveries count
- Run manual cleanup if needed
- Check server logs for timeout warnings

### Database Connection Issues
If database is unavailable:
- Check connection string in configuration
- Ensure database is running
- Check server logs for connection errors 