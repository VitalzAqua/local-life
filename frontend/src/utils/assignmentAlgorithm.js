// Assignment Algorithm - Core logic for matching orders to drivers
// This is where you'll implement your complex assignment algorithm
// Considers distance, capacity, time constraints, driver capacity, and route optimization

import { calculateDistance, calculateTravelTime } from './mapUtils';

class AssignmentAlgorithm {
  constructor() {
    this.defaultDriverSpeed = 50; // km/h
    this.maxAssignmentDistance = 20; // km - max distance for assignment
    this.bufferTime = 10; // minutes - safety buffer for delivery time
    this.maxOrdersPerDriver = 4; // Maximum orders per driver
    this.priorityWeights = {
      urgent: 10,
      high: 5,
      normal: 2,
      low: 1
    };
  }

  // Main assignment function - This is where your algorithm goes
  async findOptimalAssignments(pendingOrders, availableDrivers) {
    if (!pendingOrders || pendingOrders.length === 0) {
      return [];
    }

    if (!availableDrivers || availableDrivers.length === 0) {
      console.warn('No available drivers for assignment');
      return [];
    }

    console.log(`Finding optimal assignments for ${pendingOrders.length} orders and ${availableDrivers.length} drivers`);

    // Step 1: Filter eligible drivers for each order
    const eligibilityMatrix = this.buildEligibilityMatrix(pendingOrders, availableDrivers);
    
    // Step 2: Calculate scores for each driver-order combination
    const scoreMatrix = this.buildScoreMatrix(pendingOrders, availableDrivers, eligibilityMatrix);
    
    // Step 3: Sort orders by priority and urgency
    const sortedOrders = this.sortOrdersByPriority(pendingOrders);
    
    // Step 4: Assign orders using greedy algorithm with local optimization
    const assignments = this.greedyAssignment(sortedOrders, availableDrivers, scoreMatrix);
    
    // Step 5: Optimize assignments using local search
    const optimizedAssignments = this.localOptimization(assignments, availableDrivers);
    
    // Step 6: Calculate delivery times and validate
    const validatedAssignments = this.validateAndCalculateTimes(optimizedAssignments);
    
    console.log(`Generated ${validatedAssignments.length} optimal assignments`);
    return validatedAssignments;
  }

  buildEligibilityMatrix(orders, drivers) {
    const matrix = {};
    
    orders.forEach(order => {
      matrix[order.id] = {};
      
      drivers.forEach(driver => {
        const eligible = this.canDriverHandleOrder(driver, order, new Date());
        matrix[order.id][driver.id] = eligible;
      });
    });
    
    return matrix;
  }

  buildScoreMatrix(orders, drivers, eligibilityMatrix) {
    const matrix = {};
    
    orders.forEach(order => {
      matrix[order.id] = {};
      
      drivers.forEach(driver => {
        if (eligibilityMatrix[order.id][driver.id]) {
          const score = this.calculateDriverScore(driver, order, new Date());
          matrix[order.id][driver.id] = score;
        } else {
          matrix[order.id][driver.id] = Infinity; // Not eligible
        }
      });
    });
    
    return matrix;
  }

  sortOrdersByPriority(orders) {
    return [...orders].sort((a, b) => {
      // First sort by priority
      const aPriority = this.priorityWeights[a.priority] || 2;
      const bPriority = this.priorityWeights[b.priority] || 2;
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority; // Higher priority first
      }
      
      // Then by time elapsed since creation
      const aAge = Date.now() - new Date(a.createdAt).getTime();
      const bAge = Date.now() - new Date(b.createdAt).getTime();
      
      return bAge - aAge; // Older orders first
    });
  }

  greedyAssignment(sortedOrders, drivers, scoreMatrix) {
    const assignments = [];
    const driverCapacity = new Map();
    
    // Initialize driver capacity tracking
    drivers.forEach(driver => {
      driverCapacity.set(driver.id, {
        currentOrders: driver.currentOrders ? driver.currentOrders.length : 0,
        maxOrders: driver.maxOrders || this.maxOrdersPerDriver
      });
    });
    
    sortedOrders.forEach(order => {
      let bestDriver = null;
      let bestScore = Infinity;
      
      // Find the best available driver for this order
      drivers.forEach(driver => {
        const capacity = driverCapacity.get(driver.id);
        
        // Check if driver has capacity
        if (capacity.currentOrders >= capacity.maxOrders) {
          return; // Driver at capacity
        }
        
        const score = scoreMatrix[order.id][driver.id];
        
        if (score < bestScore) {
          bestScore = score;
          bestDriver = driver;
        }
      });
      
      if (bestDriver && bestScore < Infinity) {
        assignments.push({
          orderId: order.id,
          driverId: bestDriver.id,
          score: bestScore,
          order: order,
          driver: bestDriver
        });
        
        // Update driver capacity
        const capacity = driverCapacity.get(bestDriver.id);
        capacity.currentOrders++;
        
        console.log(`Assigned order ${order.id} to driver ${bestDriver.id} (score: ${bestScore.toFixed(2)})`);
      } else {
        console.warn(`No suitable driver found for order ${order.id}`);
      }
    });
    
    return assignments;
  }

  localOptimization(assignments, drivers) {
    // Simple 2-opt style optimization
    // Try swapping assignments to see if we can improve overall score
    
    for (let i = 0; i < assignments.length; i++) {
      for (let j = i + 1; j < assignments.length; j++) {
        const assignment1 = assignments[i];
        const assignment2 = assignments[j];
        
        // Calculate current total score
        const currentScore = assignment1.score + assignment2.score;
        
        // Calculate score if we swap assignments
        const swapScore1 = this.calculateDriverScore(assignment2.driver, assignment1.order, new Date());
        const swapScore2 = this.calculateDriverScore(assignment1.driver, assignment2.order, new Date());
        const swapScore = swapScore1 + swapScore2;
        
        // If swap improves score, make the swap
        if (swapScore < currentScore && 
            this.canDriverHandleOrder(assignment2.driver, assignment1.order, new Date()) &&
            this.canDriverHandleOrder(assignment1.driver, assignment2.order, new Date())) {
          
          assignments[i] = {
            ...assignment1,
            driverId: assignment2.driver.id,
            driver: assignment2.driver,
            score: swapScore1
          };
          
          assignments[j] = {
            ...assignment2,
            driverId: assignment1.driver.id,
            driver: assignment1.driver,
            score: swapScore2
          };
          
          console.log(`Optimized: Swapped assignments for orders ${assignment1.orderId} and ${assignment2.orderId}`);
        }
      }
    }
    
    return assignments;
  }

  validateAndCalculateTimes(assignments) {
    const validAssignments = [];
    
    assignments.forEach(assignment => {
      const { order, driver } = assignment;
      
      // Calculate pickup time
      const pickupDistance = calculateDistance(
        driver.location.lat, driver.location.lng,
        order.store.location.lat, order.store.location.lng
      );
      const pickupTime = Math.ceil((pickupDistance / this.defaultDriverSpeed) * 60); // minutes
      
      // Calculate delivery time
      const deliveryDistance = calculateDistance(
        order.store.location.lat, order.store.location.lng,
        order.customer.location.lat, order.customer.location.lng
      );
      const deliveryTime = Math.ceil((deliveryDistance / this.defaultDriverSpeed) * 60); // minutes
      
      const totalTime = pickupTime + deliveryTime + this.bufferTime;
      
      // Check if delivery can be completed within time limit
      if (totalTime <= order.timeLimit) {
        validAssignments.push({
          orderId: assignment.orderId,
          driverId: assignment.driverId,
          estimatedPickupTime: new Date(Date.now() + pickupTime * 60 * 1000),
          estimatedDeliveryTime: new Date(Date.now() + totalTime * 60 * 1000),
          totalEstimatedTime: totalTime,
          score: assignment.score
        });
      } else {
        console.warn(`Assignment rejected: Order ${assignment.orderId} cannot be delivered within time limit`);
      }
    });
    
    return validAssignments;
  }

  // Helper Functions for Algorithm Implementation

  calculateDriverScore(driver, order, currentTime) {
    if (!driver || !order) return Infinity;
    
    // Distance factor - closer drivers get better scores
    const distanceToStore = calculateDistance(
      driver.location.lat, driver.location.lng,
      order.store.location.lat, order.store.location.lng
    );
    
    const distanceToCustomer = calculateDistance(
      order.store.location.lat, order.store.location.lng,
      order.customer.location.lat, order.customer.location.lng
    );
    
    const totalDistance = distanceToStore + distanceToCustomer;
    
    // Time urgency factor - older orders get priority
    const orderAge = (currentTime.getTime() - new Date(order.createdAt).getTime()) / (1000 * 60); // minutes
    const timeUrgency = Math.max(0, order.timeLimit - orderAge) / order.timeLimit;
    
    // Capacity utilization factor
    const currentOrders = driver.currentOrders ? driver.currentOrders.length : 0;
    const maxOrders = driver.maxOrders || this.maxOrdersPerDriver;
    const capacityUtilization = currentOrders / maxOrders;
    
    // Priority factor
    const priorityFactor = this.priorityWeights[order.priority] || 2;
    
    // Calculate composite score (lower is better)
    const score = (
      totalDistance * 3.0 +                    // Distance weight
      (1 - timeUrgency) * 50.0 +               // Time urgency weight
      capacityUtilization * 10.0 +             // Capacity weight
      (10 - priorityFactor) * 2.0              // Priority weight (inverted)
    );
    
    return Math.max(0, score);
  }

  canDriverHandleOrder(driver, order, currentTime) {
    if (!driver || !order) return false;
    
    // Check if driver has capacity
    const currentOrders = driver.currentOrders ? driver.currentOrders.length : 0;
    const maxOrders = driver.maxOrders || this.maxOrdersPerDriver;
    
    if (currentOrders >= maxOrders) {
      return false;
    }
    
    // Check if driver is available
    if (driver.status !== 'available') {
      return false;
    }
    
    // Check distance constraint
    const distanceToStore = calculateDistance(
      driver.location.lat, driver.location.lng,
      order.store.location.lat, order.store.location.lng
    );
    
    if (distanceToStore > this.maxAssignmentDistance) {
      return false;
    }
    
    // Check if order can be delivered within time limit
    const deliveryDistance = calculateDistance(
      order.store.location.lat, order.store.location.lng,
      order.customer.location.lat, order.customer.location.lng
    );
    
    const totalTime = ((distanceToStore + deliveryDistance) / this.defaultDriverSpeed) * 60 + this.bufferTime;
    const orderAge = (currentTime.getTime() - new Date(order.createdAt).getTime()) / (1000 * 60);
    
    if (totalTime + orderAge > order.timeLimit) {
      return false;
    }
    
    return true;
  }

  calculateMultiOrderFeasibility(driver, existingOrders, newOrder) {
    if (!driver || !newOrder) {
      return { feasible: false, newRoute: [], totalTime: 0 };
    }
    
    // Combine existing and new orders
    const allOrders = [...(existingOrders || []), newOrder];
    
    // Check total capacity
    if (allOrders.length > (driver.maxOrders || this.maxOrdersPerDriver)) {
      return { feasible: false, newRoute: [], totalTime: 0 };
    }
    
    // Generate optimal route
    const optimizedRoute = this.optimizeRouteForDriver(driver, allOrders);
    
    // Calculate total time
    let totalTime = 0;
    let currentLocation = driver.location;
    
    optimizedRoute.forEach(waypoint => {
      const distance = calculateDistance(
        currentLocation.lat, currentLocation.lng,
        waypoint.lat, waypoint.lng
      );
      totalTime += (distance / this.defaultDriverSpeed) * 60; // minutes
      currentLocation = waypoint;
    });
    
    // Add buffer time for each stop
    totalTime += optimizedRoute.length * 3; // 3 minutes per stop
    
    // Check if all delivery deadlines can be met
    let feasible = true;
    let currentTime = new Date();
    
    allOrders.forEach(order => {
      const orderAge = (currentTime.getTime() - new Date(order.createdAt).getTime()) / (1000 * 60);
      if (totalTime + orderAge > order.timeLimit) {
        feasible = false;
      }
    });
    
    return {
      feasible,
      newRoute: optimizedRoute,
      totalTime
    };
  }

  optimizeRouteForDriver(driver, orders) {
    if (!orders || orders.length === 0) {
      return [];
    }
    
    // Simple nearest neighbor algorithm for TSP
    const waypoints = [];
    const unvisited = [];
    
    // Add all pickup and delivery locations
    orders.forEach(order => {
      unvisited.push({
        lat: order.store.location.lat,
        lng: order.store.location.lng,
        type: 'pickup',
        orderId: order.id,
        priority: order.priority
      });
      
      unvisited.push({
        lat: order.customer.location.lat,
        lng: order.customer.location.lng,
        type: 'delivery',
        orderId: order.id,
        priority: order.priority,
        mustComeAfter: order.id // Must come after pickup
      });
    });
    
    let currentLocation = driver.location;
    const completed = new Set();
    
    // Ensure pickups come before deliveries
    while (unvisited.length > 0) {
      let nextWaypoint = null;
      let minDistance = Infinity;
      
      unvisited.forEach((waypoint, index) => {
        // Skip deliveries if pickup not completed
        if (waypoint.type === 'delivery' && !completed.has(waypoint.orderId)) {
          return;
        }
        
        const distance = calculateDistance(
          currentLocation.lat, currentLocation.lng,
          waypoint.lat, waypoint.lng
        );
        
        // Prioritize urgent orders
        const priorityMultiplier = waypoint.priority === 'urgent' ? 0.5 : 
                                  waypoint.priority === 'high' ? 0.8 : 1.0;
        
        const adjustedDistance = distance * priorityMultiplier;
        
        if (adjustedDistance < minDistance) {
          minDistance = adjustedDistance;
          nextWaypoint = { waypoint, index };
        }
      });
      
      if (nextWaypoint) {
        waypoints.push(nextWaypoint.waypoint);
        currentLocation = nextWaypoint.waypoint;
        
        if (nextWaypoint.waypoint.type === 'pickup') {
          completed.add(nextWaypoint.waypoint.orderId);
        }
        
        unvisited.splice(nextWaypoint.index, 1);
      } else {
        break; // No valid waypoint found
      }
    }
    
    return waypoints;
  }

  predictDeliveryTime(fromLocation, toLocation, currentTime, trafficFactor = 1.0) {
    if (!fromLocation || !toLocation) return 30; // Default
    
    const distance = calculateDistance(
      fromLocation.lat, fromLocation.lng,
      toLocation.lat, toLocation.lng
    );
    
    const baseTime = (distance / this.defaultDriverSpeed) * 60; // minutes
    
    // Apply traffic factor
    const adjustedTime = baseTime * trafficFactor;
    
    // Add buffer time
    return Math.ceil(adjustedTime + this.bufferTime);
  }

  // Assignment Constraints and Validation

  validateTimeConstraints(driver, route, orders) {
    const violations = [];
    let currentTime = new Date();
    let currentLocation = driver.location;
    
    route.forEach((waypoint, index) => {
      const travelTime = calculateDistance(
        currentLocation.lat, currentLocation.lng,
        waypoint.lat, waypoint.lng
      ) / this.defaultDriverSpeed * 60; // minutes
      
      currentTime = new Date(currentTime.getTime() + travelTime * 60 * 1000);
      
      // Check if delivery meets deadline
      if (waypoint.type === 'delivery') {
        const order = orders.find(o => o.id === waypoint.orderId);
        if (order) {
          const orderAge = (currentTime.getTime() - new Date(order.createdAt).getTime()) / (1000 * 60);
          if (orderAge > order.timeLimit) {
            violations.push(`Order ${order.id} delivery deadline missed`);
          }
        }
      }
      
      currentLocation = waypoint;
    });
    
    return {
      valid: violations.length === 0,
      violations
    };
  }

  calculateAssignmentCost(assignments) {
    return assignments.reduce((total, assignment) => {
      return total + assignment.score;
    }, 0);
  }

  // Advanced Algorithm Features

  handleUrgentOrders(urgentOrders, availableDrivers) {
    // Handle urgent orders with higher priority
    const urgentAssignments = [];
    
    urgentOrders.forEach(order => {
      let bestDriver = null;
      let bestScore = Infinity;
      
      availableDrivers.forEach(driver => {
        if (this.canDriverHandleOrder(driver, order, new Date())) {
          const score = this.calculateDriverScore(driver, order, new Date()) * 0.5; // Boost for urgency
          if (score < bestScore) {
            bestScore = score;
            bestDriver = driver;
          }
        }
      });
      
      if (bestDriver) {
        urgentAssignments.push({
          orderId: order.id,
          driverId: bestDriver.id,
          estimatedPickupTime: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
          estimatedDeliveryTime: new Date(Date.now() + 25 * 60 * 1000), // 25 minutes
          score: bestScore
        });
      }
    });
    
    return urgentAssignments;
  }

  balanceDriverWorkload(drivers, assignments) {
    // Ensure fair distribution of work
    const driverWorkload = new Map();
    
    drivers.forEach(driver => {
      driverWorkload.set(driver.id, 0);
    });
    
    assignments.forEach(assignment => {
      const current = driverWorkload.get(assignment.driverId) || 0;
      driverWorkload.set(assignment.driverId, current + 1);
    });
    
    // Identify overloaded drivers
    const avgWorkload = assignments.length / drivers.length;
    const adjustments = [];
    
    driverWorkload.forEach((workload, driverId) => {
      if (workload > avgWorkload * 1.5) {
        adjustments.push({
          driverId,
          action: 'reduce_load',
          currentWorkload: workload,
          targetWorkload: Math.floor(avgWorkload)
        });
      }
    });
    
    return adjustments;
  }

  dynamicReassignment(activeDrivers, newOrders, currentTime) {
    // Handle dynamic reassignment when new orders arrive
    const reassignments = [];
    
    newOrders.forEach(newOrder => {
      if (newOrder.priority === 'urgent') {
        // Find best driver even if they have current assignments
        let bestDriver = null;
        let bestScore = Infinity;
        
        activeDrivers.forEach(driver => {
          const score = this.calculateDriverScore(driver, newOrder, currentTime);
          if (score < bestScore) {
            bestScore = score;
            bestDriver = driver;
          }
        });
        
        if (bestDriver) {
          reassignments.push({
            type: 'urgent_insertion',
            orderId: newOrder.id,
            driverId: bestDriver.id,
            priority: 'urgent'
          });
        }
      }
    });
    
    return reassignments;
  }
}

export default new AssignmentAlgorithm();

// Algorithm Implementation Tips:
/*
1. Start Simple: Implement a basic nearest-driver assignment first
2. Add Constraints: Gradually add time limits, capacity, etc.
3. Optimize Routes: Implement basic TSP solver for route optimization
4. Machine Learning: Consider learning from historical data
5. Real-time Adaptation: Handle dynamic changes during execution

Performance Considerations:
- Cache distance calculations
- Use approximate algorithms for large datasets
- Implement time limits for algorithm execution
- Consider parallel processing for independent calculations

Testing Strategy:
- Create mock data with various scenarios
- Test edge cases (all drivers busy, impossible deadlines)
- Measure algorithm performance and accuracy
- A/B test different algorithm variations
*/ 