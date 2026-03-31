const pool = require('./database');

class DriverAssignmentService {
  constructor() {
    this.assignmentQueue = [];
    this.processing = false;
    this.MAX_TOTAL_ETA_HOURS = 2; // 2 hour limit
    this.SPEED_KMH = 40; // Average speed including stops
    this.STOP_TIME_MINUTES = 8; // Time for pickup/delivery
    this.PREPARATION_TIME_MINUTES = 5; // Time for restaurant preparation
  }

  async getDriversWithDeliveries() {
    try {
      const query = `
        SELECT 
          d.id as driver_id,
          d.name as driver_name,
          COALESCE(d.license_plate, d.car) as vehicle_info,
          d.current_lat,
          d.current_lng,
          d.is_available,
          d.is_online,
          d.speed_kmh,
          d.max_concurrent_orders,
          COALESCE(
            json_agg(
              CASE WHEN del.id IS NOT NULL THEN
                json_build_object(
                  'delivery_id', del.id,
                  'order_id', del.order_id,
                  'status', del.status,
                  'restaurant_location', del.restaurant_location,
                  'customer_location', del.customer_location,
                  'assigned_at', del.assigned_at,
                  'route_order', del.route_order
                )
              END
            ) FILTER (WHERE del.id IS NOT NULL),
            '[]'::json
          ) as current_deliveries
        FROM drivers d
        LEFT JOIN deliveries del ON d.id = del.driver_id 
          AND del.status NOT IN ('completed', 'cancelled')
        WHERE d.is_online = true
        GROUP BY d.id, d.name, d.car, d.license_plate,
                 d.current_lat, d.current_lng, d.is_available, d.is_online,
                 d.speed_kmh, d.max_concurrent_orders
        ORDER BY d.id
      `;
      
      const result = await pool.query(query);
      
      return result.rows.map(driver => ({
        ...driver,
        latitude: parseFloat(driver.current_lat),
        longitude: parseFloat(driver.current_lng),
        current_deliveries: driver.current_deliveries || [],
        max_concurrent_orders: driver.max_concurrent_orders || 3
      }));
    } catch (error) {
      console.error('🚨 Error fetching drivers with deliveries:', error);
      throw error;
    }
  }

  // Distance calculation using the Haversine formula.
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Travel time in minutes between two coordinates.
  calculateTravelTime(lat1, lon1, lat2, lon2, speedKmh = null) {
    const distance = this.calculateDistance(lat1, lon1, lat2, lon2);
    const speed = speedKmh || this.SPEED_KMH;
    return (distance / speed) * 60; // Convert to minutes
  }

  generateDeliverySequences(deliveries) {
    if (deliveries.length === 0) return [[]];
    if (deliveries.length === 1) {
      const delivery = deliveries[0];
      return [
        [
          { type: 'pickup', delivery, location: delivery.restaurant_location },
          { type: 'dropoff', delivery, location: delivery.customer_location }
        ]
      ];
    }

    const sequences = [];
    const deliveryStops = [];

    deliveries.forEach(delivery => {
      deliveryStops.push(
        { type: 'pickup', delivery, location: delivery.restaurant_location },
        { type: 'dropoff', delivery, location: delivery.customer_location }
      );
    });

    const permutations = this.getPermutations(deliveryStops);
    
    const validSequences = permutations.filter(sequence => {
      const orderPositions = {};
      
      for (let i = 0; i < sequence.length; i++) {
        const stop = sequence[i];
        const orderId = stop.delivery.order_id;
        
        if (!orderPositions[orderId]) {
          orderPositions[orderId] = {};
        }
        
        orderPositions[orderId][stop.type] = i;
      }
      
      return Object.values(orderPositions).every(positions => 
        positions.pickup < positions.dropoff
      );
    });

    return validSequences;
  }

  getPermutations(arr) {
    if (arr.length <= 1) return [arr];
    
    const permutations = [];
    for (let i = 0; i < arr.length; i++) {
      const current = arr[i];
      const remaining = arr.slice(0, i).concat(arr.slice(i + 1));
      const remainingPermutations = this.getPermutations(remaining);
      
      for (const perm of remainingPermutations) {
        permutations.push([current, ...perm]);
      }
    }
    
    return permutations;
  }

  calculateSequenceETA(driverLocation, sequence, speedKmh = null) {
    if (sequence.length === 0) return 0;

    let totalTime = 0;
    let currentLat = driverLocation.latitude;
    let currentLng = driverLocation.longitude;

    for (const stop of sequence) {
      const travelTime = this.calculateTravelTime(
        currentLat, currentLng,
        stop.location.lat, stop.location.lng,
        speedKmh
      );
      totalTime += travelTime;

      if (stop.type === 'pickup') {
        totalTime += this.PREPARATION_TIME_MINUTES + this.STOP_TIME_MINUTES;
      } else {
        totalTime += this.STOP_TIME_MINUTES;
      }

      currentLat = stop.location.lat;
      currentLng = stop.location.lng;
    }

    return totalTime; // Return in minutes
  }

  findOptimalSequence(driver, newDelivery) {
    console.log(`🔍 Finding optimal sequence for driver ${driver.driver_name}:`);
    console.log(`  Driver location: ${driver.latitude}, ${driver.longitude}`);
    console.log(`  Existing deliveries: ${driver.current_deliveries.length}`);
    console.log(`  New delivery: ${newDelivery.order_id}`);
    
    if (!driver.latitude || !driver.longitude || isNaN(driver.latitude) || isNaN(driver.longitude)) {
      console.error(`❌ Invalid driver location for ${driver.driver_name}: ${driver.latitude}, ${driver.longitude}`);
      return {
        sequence: null,
        totalETA: Infinity,
        isValid: false
      };
    }
    
    if (!newDelivery.restaurant_location || !newDelivery.customer_location) {
      console.error(`❌ Missing location data for order ${newDelivery.order_id}`);
      return {
        sequence: null,
        totalETA: Infinity,
        isValid: false
      };
    }
    
    const validateLocation = (loc, name) => {
      if (!loc || typeof loc !== 'object') {
        console.error(`❌ Invalid ${name} location: not an object`);
        return false;
      }
      if (!loc.lat && !loc.latitude) {
        console.error(`❌ Invalid ${name} location: missing latitude`);
        return false;
      }
      if (!loc.lng && !loc.longitude) {
        console.error(`❌ Invalid ${name} location: missing longitude`);
        return false;
      }
      return true;
    };
    
    if (!validateLocation(newDelivery.restaurant_location, 'restaurant') ||
        !validateLocation(newDelivery.customer_location, 'customer')) {
      return {
        sequence: null,
        totalETA: Infinity,
        isValid: false
      };
    }
    
    const normalizeLocation = (loc) => ({
      lat: loc.lat || loc.latitude,
      lng: loc.lng || loc.longitude
    });
    
    const existingDeliveries = driver.current_deliveries.map(del => ({
      order_id: del.order_id,
      restaurant_location: normalizeLocation(del.restaurant_location),
      customer_location: normalizeLocation(del.customer_location),
      delivery_id: del.delivery_id
    }));

    const normalizedNewDelivery = {
      order_id: newDelivery.order_id,
      restaurant_location: normalizeLocation(newDelivery.restaurant_location),
      customer_location: normalizeLocation(newDelivery.customer_location)
    };

    console.log(`  Normalized restaurant location: ${normalizedNewDelivery.restaurant_location.lat}, ${normalizedNewDelivery.restaurant_location.lng}`);
    console.log(`  Normalized customer location: ${normalizedNewDelivery.customer_location.lat}, ${normalizedNewDelivery.customer_location.lng}`);

    const allDeliveries = [...existingDeliveries, normalizedNewDelivery];
    const sequences = this.generateDeliverySequences(allDeliveries);
    
    console.log(`  Generated ${sequences.length} possible sequences`);

    if (sequences.length === 0) {
      console.error(`❌ No valid sequences generated for driver ${driver.driver_name}`);
      return {
        sequence: null,
        totalETA: Infinity,
        isValid: false
      };
    }

    let bestSequence = null;
    let shortestTime = Infinity;

    for (let i = 0; i < sequences.length; i++) {
      const sequence = sequences[i];
      
      try {
        const totalTime = this.calculateSequenceETA(
          { latitude: driver.latitude, longitude: driver.longitude },
          sequence,
          driver.speed_kmh
        );
        
        console.log(`    Sequence ${i + 1}: ${totalTime.toFixed(1)} minutes`);

        if (!isNaN(totalTime) && totalTime < shortestTime && totalTime <= this.MAX_TOTAL_ETA_HOURS * 60) {
          shortestTime = totalTime;
          bestSequence = sequence;
        }
      } catch (error) {
        console.error(`❌ Error calculating ETA for sequence ${i + 1}:`, error);
      }
    }

    const result = {
      sequence: bestSequence,
      totalETA: shortestTime,
      isValid: shortestTime !== Infinity && shortestTime <= this.MAX_TOTAL_ETA_HOURS * 60
    };
    
    console.log(`  Best sequence ETA: ${shortestTime === Infinity ? 'Infinity' : (shortestTime/60).toFixed(1)}h`);
    console.log(`  Valid: ${result.isValid}`);
    
    return result;
  }

  // Find the best driver for a new order
  async findBestDriverForOrder(newOrder) {
    try {
      const drivers = await this.getDriversWithDeliveries();
      
      let bestDriver = null;
      let bestSequence = null;
      let shortestTime = Infinity;

      console.log(`🔍 Evaluating ${drivers.length} drivers for order ${newOrder.orderId}`);

      for (const driver of drivers) {
        // Skip if driver is at max capacity
        if (driver.current_deliveries.length >= driver.max_concurrent_orders) {
          console.log(`⏭️  Driver ${driver.driver_name} at max capacity (${driver.current_deliveries.length}/${driver.max_concurrent_orders})`);
          continue;
        }

        const newDelivery = {
          order_id: newOrder.orderId,
          restaurant_location: newOrder.storeLocation,
          customer_location: newOrder.customerLocation
        };

        const result = this.findOptimalSequence(driver, newDelivery);

        if (result.isValid && result.totalETA < shortestTime) {
          shortestTime = result.totalETA;
          bestDriver = driver;
          bestSequence = result.sequence;
          
          console.log(`🏆 New best: Driver ${driver.driver_name} - ${(result.totalETA/60).toFixed(1)}h total ETA`);
        } else if (!result.isValid) {
          console.log(`❌ Driver ${driver.driver_name} exceeds 2h limit: ${(result.totalETA/60).toFixed(1)}h`);
        }
      }

      if (bestDriver && bestSequence) {
        console.log(`🎯 Selected driver ${bestDriver.driver_name} with ${(shortestTime/60).toFixed(1)}h total ETA`);
        return {
          driver: bestDriver,
          sequence: bestSequence,
          totalETA: shortestTime
        };
      }

      console.log('❌ No suitable driver found within 2h limit');
      return null;
    } catch (error) {
      console.error('🚨 Error finding best driver:', error);
      throw error;
    }
  }

  // Assign driver to order with optimized route
  async assignDriverToOrder(assignment) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const { driver, sequence, totalETA, newOrder } = assignment;

      // Create delivery record for new order
      const deliveryResult = await client.query(`
        INSERT INTO deliveries (
          order_id, 
          driver_id, 
          status, 
          restaurant_location,
          customer_location,
          assigned_at,
          estimated_delivery_time,
          route_order
        ) VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)
        RETURNING id
      `, [
        newOrder.orderId,
        driver.driver_id,
        'assigned',
        JSON.stringify(newOrder.storeLocation),
        JSON.stringify(newOrder.customerLocation),
        Math.ceil(totalETA), // Total ETA in minutes
        this.getRouteOrderForNewDelivery(sequence, newOrder.orderId)
      ]);

      // Update route orders for existing deliveries
      await this.updateExistingDeliveryRoutes(client, driver.driver_id, sequence);

      // Update order status
      await client.query(`
        UPDATE orders 
        SET status = 'assigned', updated_at = NOW() 
        WHERE id = $1
      `, [newOrder.orderId]);

      // Update driver availability
      await client.query(`
        UPDATE drivers 
        SET is_available = false, updated_at = NOW() 
        WHERE id = $1
      `, [driver.driver_id]);

      await client.query('COMMIT');
      
      console.log(`✅ Order ${newOrder.orderId} assigned to ${driver.driver_name} (Total ETA: ${(totalETA/60).toFixed(1)}h)`);
      
      return {
        success: true,
        deliveryId: deliveryResult.rows[0].id,
        driver: driver,
        totalETA: totalETA,
        sequence: sequence
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('🚨 Error assigning driver:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Get route order for new delivery in optimized sequence
  getRouteOrderForNewDelivery(sequence, orderId) {
    for (let i = 0; i < sequence.length; i++) {
      if (sequence[i].delivery.order_id === orderId && sequence[i].type === 'pickup') {
        return i + 1; // 1-based indexing
      }
    }
    return 1;
  }

  // Update route orders for existing deliveries based on new optimized sequence
  async updateExistingDeliveryRoutes(client, driverId, sequence) {
    const routeUpdates = new Map();
    
    // Build route order mapping
    sequence.forEach((stop, index) => {
      if (stop.type === 'pickup') {
        const orderId = stop.delivery.order_id;
        routeUpdates.set(orderId, index + 1);
      }
    });

    // Update existing deliveries
    for (const [orderId, routeOrder] of routeUpdates) {
      await client.query(`
        UPDATE deliveries 
        SET route_order = $1, updated_at = NOW()
        WHERE driver_id = $2 AND order_id = $3 AND status NOT IN ('completed', 'cancelled')
      `, [routeOrder, driverId, orderId]);
    }
  }

  // Process assignment request with multi-delivery optimization
  async processAssignment(assignmentRequest) {
    const { orderId, storeLocation, customerLocation } = assignmentRequest;
    
    try {
      console.log(`🚀 Processing optimized assignment for order ${orderId}`);
      
      const newOrder = {
        orderId,
        storeLocation,
        customerLocation
      };

      const assignment = await this.findBestDriverForOrder(newOrder);
      
      if (!assignment) {
        console.log('❌ No available drivers within 2h ETA limit');
        return {
          success: false,
          message: 'No available drivers within 2-hour delivery window'
        };
      }

      // Assign the driver
      const result = await this.assignDriverToOrder({
        ...assignment,
        newOrder
      });
      
      return {
        success: true,
        driver: result.driver,
        totalETA: Math.ceil(result.totalETA),
        sequence: result.sequence,
        message: `Assigned to ${result.driver.driver_name} (${(result.totalETA/60).toFixed(1)}h total ETA)`
      };
    } catch (error) {
      console.error('🚨 Assignment processing error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Get driver performance stats
  async getDriverStats(driverId) {
    try {
      const result = await pool.query(`
        SELECT 
          d.name,
          d.current_lat,
          d.current_lng,
          COUNT(del.id) as active_deliveries,
          d.max_concurrent_orders,
          COALESCE(SUM(del.estimated_delivery_time), 0) as total_eta_minutes
        FROM drivers d
        LEFT JOIN deliveries del ON d.id = del.driver_id 
          AND del.status NOT IN ('completed', 'cancelled')
        WHERE d.id = $1
        GROUP BY d.id, d.name, d.current_lat, d.current_lng, d.max_concurrent_orders
      `, [driverId]);

      if (result.rows.length === 0) return null;

      const stats = result.rows[0];
      return {
        ...stats,
        total_eta_hours: (stats.total_eta_minutes / 60).toFixed(1),
        capacity_utilization: `${stats.active_deliveries}/${stats.max_concurrent_orders}`,
        within_limit: stats.total_eta_minutes <= (this.MAX_TOTAL_ETA_HOURS * 60)
      };
    } catch (error) {
      console.error('🚨 Error getting driver stats:', error);
      throw error;
    }
  }

  // Add assignment to queue
  async queueAssignment(assignmentRequest) {
    this.assignmentQueue.push(assignmentRequest);
    console.log(`📋 Assignment queued for order ${assignmentRequest.orderId}`);
    
    if (!this.processing) {
      this.processQueue();
    }
  }

  // Process assignment queue
  async processQueue() {
    if (this.processing || this.assignmentQueue.length === 0) {
      return;
    }

    this.processing = true;
    console.log(`⚡ Processing ${this.assignmentQueue.length} assignments in queue`);

    while (this.assignmentQueue.length > 0) {
      const assignment = this.assignmentQueue.shift();
      await this.processAssignment(assignment);
      
      // Small delay to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.processing = false;
    console.log('✅ Assignment queue processed');
  }
}

module.exports = new DriverAssignmentService(); 
