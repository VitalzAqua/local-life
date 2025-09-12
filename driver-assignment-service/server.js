const express = require('express');
const cors = require('cors');
const config = require('./config');
const driverAssignmentService = require('./driverAssignmentService');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'driver-assignment-service-optimized',
    timestamp: new Date().toISOString(),
    features: {
      multiDelivery: true,
      routeOptimization: true,
      maxETAHours: 2
    }
  });
});

// Get all drivers with their current deliveries
app.get('/drivers', async (req, res) => {
  try {
    const drivers = await driverAssignmentService.getDriversWithDeliveries();
    res.json({
      success: true,
      count: drivers.length,
      drivers
    });
  } catch (error) {
    console.error('❌ Error getting drivers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get drivers'
    });
  }
});

// Get available drivers (legacy compatibility)
app.get('/drivers/available', async (req, res) => {
  try {
    const drivers = await driverAssignmentService.getDriversWithDeliveries();
    const availableDrivers = drivers.filter(driver => 
      driver.current_deliveries.length < driver.max_concurrent_orders
    );
    
    res.json({
      success: true,
      count: availableDrivers.length,
      drivers: availableDrivers
    });
  } catch (error) {
    console.error('❌ Error getting available drivers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get available drivers'
    });
  }
});

// Get driver statistics
app.get('/drivers/:id/stats', async (req, res) => {
  try {
    const driverId = parseInt(req.params.id);
    const stats = await driverAssignmentService.getDriverStats(driverId);
    
    if (!stats) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('❌ Error getting driver stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get driver stats'
    });
  }
});

// Assign driver to order with route optimization
app.post('/assign', async (req, res) => {
  try {
    const { orderId, storeLocation, customerLocation } = req.body;
    
    // Validate request
    if (!orderId || !storeLocation) {
      return res.status(400).json({
        success: false,
        message: 'orderId and storeLocation are required'
      });
    }

    // Validate location format
    if (!storeLocation.latitude || !storeLocation.longitude) {
      return res.status(400).json({
        success: false,
        message: 'storeLocation must include latitude and longitude'
      });
    }

    console.log(`📨 Optimized assignment request received for order ${orderId}`);
    
    // Process assignment with route optimization
    const result = await driverAssignmentService.processAssignment({
      orderId,
      storeLocation,
      customerLocation
    });
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        driver: result.driver,
        totalETA: result.totalETA,
        totalETAHours: (result.totalETA / 60).toFixed(1),
        sequence: result.sequence,
        optimized: true
      });
    } else {
      res.status(404).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('❌ Assignment error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Queue assignment (for high-load scenarios)
app.post('/assign/queue', async (req, res) => {
  try {
    const { orderId, storeLocation, customerLocation } = req.body;
    
    if (!orderId || !storeLocation) {
      return res.status(400).json({
        success: false,
        message: 'orderId and storeLocation are required'
      });
    }

    await driverAssignmentService.queueAssignment({
      orderId,
      storeLocation,
      customerLocation
    });
    
    res.json({
      success: true,
      message: 'Assignment queued for route optimization'
    });
  } catch (error) {
    console.error('❌ Queue assignment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to queue assignment'
    });
  }
});

// Get queue status
app.get('/queue/status', (req, res) => {
  res.json({
    queueLength: driverAssignmentService.assignmentQueue.length,
    processing: driverAssignmentService.processing,
    maxETAHours: driverAssignmentService.MAX_TOTAL_ETA_HOURS
  });
});

// Find best driver for location with route optimization preview
app.post('/drivers/find-best', async (req, res) => {
  try {
    const { orderId, storeLocation, customerLocation } = req.body;
    
    if (!storeLocation || !storeLocation.latitude || !storeLocation.longitude) {
      return res.status(400).json({
        success: false,
        message: 'storeLocation with latitude and longitude is required'
      });
    }

    const assignment = await driverAssignmentService.findBestDriverForOrder({
      orderId: orderId || 'preview',
      storeLocation,
      customerLocation
    });
    
    if (assignment) {
      res.json({
        success: true,
        driver: assignment.driver,
        totalETA: assignment.totalETA,
        totalETAHours: (assignment.totalETA / 60).toFixed(1),
        sequence: assignment.sequence,
        preview: true
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'No available drivers within 2-hour delivery window'
      });
    }
  } catch (error) {
    console.error('❌ Find best driver error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to find best driver'
    });
  }
});

// Get system configuration
app.get('/config', (req, res) => {
  res.json({
    success: true,
    config: {
      maxETAHours: driverAssignmentService.MAX_TOTAL_ETA_HOURS,
      speedKmh: driverAssignmentService.SPEED_KMH,
      stopTimeMinutes: driverAssignmentService.STOP_TIME_MINUTES,
      preparationTimeMinutes: driverAssignmentService.PREPARATION_TIME_MINUTES,
      features: {
        multiDelivery: true,
        routeOptimization: true,
        permutationOptimization: true
      }
    }
  });
});

// Update system configuration (admin endpoint)
app.post('/config', async (req, res) => {
  try {
    const { maxETAHours, speedKmh, stopTimeMinutes, preparationTimeMinutes } = req.body;
    
    if (maxETAHours !== undefined) {
      driverAssignmentService.MAX_TOTAL_ETA_HOURS = Math.max(0.5, Math.min(8, maxETAHours));
    }
    if (speedKmh !== undefined) {
      driverAssignmentService.SPEED_KMH = Math.max(10, Math.min(100, speedKmh));
    }
    if (stopTimeMinutes !== undefined) {
      driverAssignmentService.STOP_TIME_MINUTES = Math.max(1, Math.min(30, stopTimeMinutes));
    }
    if (preparationTimeMinutes !== undefined) {
      driverAssignmentService.PREPARATION_TIME_MINUTES = Math.max(1, Math.min(30, preparationTimeMinutes));
    }
    
    res.json({
      success: true,
      message: 'Configuration updated',
      config: {
        maxETAHours: driverAssignmentService.MAX_TOTAL_ETA_HOURS,
        speedKmh: driverAssignmentService.SPEED_KMH,
        stopTimeMinutes: driverAssignmentService.STOP_TIME_MINUTES,
        preparationTimeMinutes: driverAssignmentService.PREPARATION_TIME_MINUTES
      }
    });
  } catch (error) {
    console.error('❌ Config update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update configuration'
    });
  }
});

// Get analytics on assignment performance
app.get('/analytics', async (req, res) => {
  try {
    const drivers = await driverAssignmentService.getDriversWithDeliveries();
    
    const analytics = {
      totalDrivers: drivers.length,
      activeDrivers: drivers.filter(d => d.current_deliveries.length > 0).length,
      availableDrivers: drivers.filter(d => d.current_deliveries.length < d.max_concurrent_orders).length,
      atCapacity: drivers.filter(d => d.current_deliveries.length >= d.max_concurrent_orders).length,
      totalActiveDeliveries: drivers.reduce((sum, d) => sum + d.current_deliveries.length, 0),
      averageDeliveriesPerDriver: drivers.length > 0 ? 
        (drivers.reduce((sum, d) => sum + d.current_deliveries.length, 0) / drivers.length).toFixed(2) : 0,
      systemConfiguration: {
        maxETAHours: driverAssignmentService.MAX_TOTAL_ETA_HOURS,
        speedKmh: driverAssignmentService.SPEED_KMH
      }
    };
    
    res.json({
      success: true,
      analytics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get analytics'
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('🚨 Unhandled error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Start server
app.listen(config.port, () => {
  console.log(`🚀 Optimized Driver Assignment Service running on port ${config.port}`);
  console.log(`📍 Health check: http://localhost:${config.port}/health`);
  console.log(`🎯 Assignment endpoint: http://localhost:${config.port}/assign`);
  console.log(`📊 Analytics: http://localhost:${config.port}/analytics`);
  console.log(`⚙️  Configuration: http://localhost:${config.port}/config`);
  console.log(`🔧 Features: Multi-delivery, Route optimization, 2h ETA limit`);
}); 