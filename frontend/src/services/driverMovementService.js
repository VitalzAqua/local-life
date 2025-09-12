// Driver Movement Service - Simulates real-time driver movement
// Handles mock GPS tracking, route following, and movement animation

import { calculateDistance, calculateBearing, getPointAtDistance } from '../utils/mapUtils';
import deliveryService from './deliveryService';

class DriverMovementService {
  constructor() {
    this.activeDrivers = new Map(); // Map<driverId, movementState>
    this.movementIntervals = new Map(); // Map<driverId, intervalId>
    this.updateCallbacks = new Set(); // Callbacks for location updates
    this.simulationSpeed = 1; // 1 = real-time, 2 = 2x speed, etc.
    this.updateInterval = 2000; // Update every 2 seconds
    this.isRunning = false;
  }

  // Movement Simulation Control
  startSimulation() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('Starting driver movement simulation...');
    
    // Initialize movement for all active drivers
    this.activeDrivers.forEach((state, driverId) => {
      this.startDriverMovement(driverId);
    });
  }

  stopSimulation() {
    console.log('Stopping driver movement simulation...');
    this.isRunning = false;
    
    // Clear all movement intervals
    this.movementIntervals.forEach((intervalId) => {
      clearInterval(intervalId);
    });
    this.movementIntervals.clear();
  }

  pauseSimulation() {
    this.isRunning = false;
    this.movementIntervals.forEach((intervalId) => {
      clearInterval(intervalId);
    });
    this.movementIntervals.clear();
  }

  resumeSimulation() {
    if (this.isRunning) return;
    this.startSimulation();
  }

  setSimulationSpeed(speed) {
    this.simulationSpeed = Math.max(0.1, Math.min(10, speed)); // Clamp between 0.1x and 10x
    this.updateInterval = 2000 / this.simulationSpeed;
    
    // Restart simulation with new speed
    if (this.isRunning) {
      this.stopSimulation();
      this.startSimulation();
    }
  }

  // Driver Movement Management
  addDriver(driver) {
    const movementState = {
      driver: driver,
      currentLocation: driver.location || { 
        lat: 43.6532 + (Math.random() - 0.5) * 0.1, 
        lng: -79.3832 + (Math.random() - 0.5) * 0.1 
      },
      targetLocation: null,
      route: [],
      routeIndex: 0,
      speed: driver.speed || 50, // km/h
      bearing: 0,
      isMoving: false,
      lastUpdate: new Date(),
      totalDistance: 0,
      estimatedArrival: null,
      isIdle: true
    };
    
    this.activeDrivers.set(driver.id, movementState);
    
    if (this.isRunning) {
      this.startDriverMovement(driver.id);
    }
    
    console.log(`Added driver ${driver.name} to movement simulation`);
  }

  removeDriver(driverId) {
    // Stop movement updates
    if (this.movementIntervals.has(driverId)) {
      clearInterval(this.movementIntervals.get(driverId));
      this.movementIntervals.delete(driverId);
    }
    
    // Remove from active drivers
    this.activeDrivers.delete(driverId);
    
    console.log(`Removed driver ${driverId} from movement simulation`);
  }

  updateDriverRoute(driverId, newRoute) {
    const state = this.activeDrivers.get(driverId);
    if (!state) return;
    
    // Convert route to waypoints
    const waypoints = [];
    newRoute.forEach(stop => {
      waypoints.push({
        lat: stop.location.lat,
        lng: stop.location.lng,
        type: stop.type,
        orderId: stop.orderId,
        name: stop.name,
        address: stop.address
      });
    });
    
    state.route = waypoints;
    state.routeIndex = 0;
    state.isMoving = waypoints.length > 0;
    state.isIdle = waypoints.length === 0;
    
    if (waypoints.length > 0) {
      state.targetLocation = waypoints[0];
      state.bearing = calculateBearing(
        state.currentLocation.lat, state.currentLocation.lng,
        state.targetLocation.lat, state.targetLocation.lng
      );
      
      // Calculate estimated arrival time
      const totalDistance = this.calculateRouteDistance(waypoints, state.currentLocation);
      const estimatedTimeHours = totalDistance / state.speed;
      state.estimatedArrival = new Date(Date.now() + estimatedTimeHours * 60 * 60 * 1000);
    }
    
    console.log(`Updated route for driver ${driverId}: ${waypoints.length} waypoints`);
  }

  calculateRouteDistance(waypoints, currentLocation) {
    if (waypoints.length === 0) return 0;
    
    let totalDistance = 0;
    let prevLocation = currentLocation;
    
    waypoints.forEach(waypoint => {
      totalDistance += calculateDistance(
        prevLocation.lat, prevLocation.lng,
        waypoint.lat, waypoint.lng
      );
      prevLocation = waypoint;
    });
    
    return totalDistance;
  }

  startDriverMovement(driverId) {
    if (this.movementIntervals.has(driverId)) {
      clearInterval(this.movementIntervals.get(driverId));
    }
    
    const intervalId = setInterval(() => {
      this.updateDriverPosition(driverId);
    }, this.updateInterval);
    
    this.movementIntervals.set(driverId, intervalId);
  }

  updateDriverPosition(driverId) {
    const state = this.activeDrivers.get(driverId);
    if (!state) return;
    
    const now = new Date();
    const timeElapsed = (now - state.lastUpdate) / 1000; // seconds
    
    if (state.isIdle || !state.isMoving) {
      // Generate random idle movement
      this.generateRandomMovement(driverId);
      return;
    }
    
    // Calculate movement
    const result = this.calculateNextPosition(driverId, timeElapsed);
    
    if (result) {
      state.currentLocation = result.newLocation;
      state.bearing = result.bearing;
      state.lastUpdate = now;
      
      // Check if reached destination
      if (result.reachedDestination) {
        this.handleWaypointReached(driverId);
      }
      
      // Broadcast location update
      this.broadcastLocationUpdate(driverId, state.currentLocation);
    }
  }

  // Movement Calculation
  calculateNextPosition(driverId, timeElapsed) {
    const state = this.activeDrivers.get(driverId);
    if (!state || !state.targetLocation) return null;
    
    // Calculate distance to travel
    const speedMs = (state.speed * 1000) / 3600; // m/s
    const distanceToTravel = speedMs * timeElapsed * this.simulationSpeed;
    
    // Calculate distance to current target
    const distanceToTarget = calculateDistance(
      state.currentLocation.lat, state.currentLocation.lng,
      state.targetLocation.lat, state.targetLocation.lng
    ) * 1000; // Convert to meters
    
    let newLocation;
    let reachedDestination = false;
    
    if (distanceToTravel >= distanceToTarget) {
      // Reached current waypoint
      newLocation = { ...state.targetLocation };
      reachedDestination = true;
    } else {
      // Move towards target
      const progress = distanceToTravel / distanceToTarget;
      newLocation = this.interpolatePosition(
        state.currentLocation,
        state.targetLocation,
        progress
      );
    }
    
    const bearing = calculateBearing(
      state.currentLocation.lat, state.currentLocation.lng,
      newLocation.lat, newLocation.lng
    );
    
    return {
      newLocation,
      bearing,
      reachedDestination
    };
  }

  async handleWaypointReached(driverId) {
    const state = this.activeDrivers.get(driverId);
    if (!state) return;
    
    const currentWaypoint = state.route[state.routeIndex];
    
    if (currentWaypoint) {
      console.log(`Driver ${driverId} reached ${currentWaypoint.type} at ${currentWaypoint.name}`);
      
      // Handle pickup/delivery with backend integration
      if (currentWaypoint.type === 'pickup') {
        await this.simulatePickup(driverId, currentWaypoint.orderId, currentWaypoint);
      } else if (currentWaypoint.type === 'delivery') {
        await this.simulateDelivery(driverId, currentWaypoint.orderId, currentWaypoint);
      }
    }
    
    // Move to next waypoint
    state.routeIndex++;
    
    if (state.routeIndex >= state.route.length) {
      // Route completed
      state.isMoving = false;
      state.isIdle = true;
      state.targetLocation = null;
      state.route = [];
      state.routeIndex = 0;
      console.log(`Driver ${driverId} completed route`);
    } else {
      // Set next target
      state.targetLocation = state.route[state.routeIndex];
      state.bearing = calculateBearing(
        state.currentLocation.lat, state.currentLocation.lng,
        state.targetLocation.lat, state.targetLocation.lng
      );
    }
  }

  interpolatePosition(startLocation, endLocation, progress) {
    const lat = startLocation.lat + (endLocation.lat - startLocation.lat) * progress;
    const lng = startLocation.lng + (endLocation.lng - startLocation.lng) * progress;
    return { lat, lng };
  }

  // Route Generation and Following
  generateRandomMovement(driverId) {
    const state = this.activeDrivers.get(driverId);
    if (!state || !state.isIdle) return;
    
    // Small random movement to simulate idle behavior
    const randomDistance = 0.001; // Very small movement
    const randomBearing = Math.random() * 360;
    
    const radians = (randomBearing * Math.PI) / 180;
    const newLat = state.currentLocation.lat + Math.cos(radians) * randomDistance;
    const newLng = state.currentLocation.lng + Math.sin(radians) * randomDistance;
    
    state.currentLocation = { lat: newLat, lng: newLng };
    state.bearing = randomBearing;
    
    // Occasionally broadcast idle movement
    if (Math.random() < 0.3) {
      this.broadcastLocationUpdate(driverId, state.currentLocation);
    }
  }

  simulateTrafficDelays(baseSpeed, currentTime, location) {
    const hour = currentTime.getHours();
    let adjustedSpeed = baseSpeed;
    
    // Rush hour delays
    if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
      adjustedSpeed *= 0.7; // 30% slower
    } else if (hour >= 11 && hour <= 14) {
      adjustedSpeed *= 0.85; // 15% slower
    }
    
    // Random traffic variations
    const randomFactor = 0.9 + Math.random() * 0.2; // 90% to 110%
    adjustedSpeed *= randomFactor;
    
    return Math.max(10, adjustedSpeed); // Minimum 10 km/h
  }

  handleRouteDeviations(driverId) {
    const state = this.activeDrivers.get(driverId);
    if (!state) return;
    
    // Occasionally add small deviations to make movement more realistic
    if (Math.random() < 0.1) { // 10% chance
      const deviation = 0.0005; // Small deviation
      state.currentLocation.lat += (Math.random() - 0.5) * deviation;
      state.currentLocation.lng += (Math.random() - 0.5) * deviation;
    }
  }

  // Real-time Updates and Notifications
  async broadcastLocationUpdate(driverId, newLocation) {
    const updateData = {
      driverId,
      location: {
        ...newLocation,
        timestamp: new Date()
      }
    };
    
    // Update backend with new location
    try {
      await deliveryService.updateDriverLocation(driverId, newLocation.lat, newLocation.lng);
    } catch (error) {
      console.error('Error updating driver location in backend:', error);
    }
    
    // Notify frontend callbacks
    this.updateCallbacks.forEach(callback => {
      try {
        callback(updateData);
      } catch (error) {
        console.error('Error in location update callback:', error);
      }
    });
  }

  onLocationUpdate(callback) {
    this.updateCallbacks.add(callback);
    
    return () => {
      this.updateCallbacks.delete(callback);
    };
  }

  offLocationUpdate(callback) {
    this.updateCallbacks.delete(callback);
  }

  // Delivery Simulation
  async simulatePickup(driverId, orderId, pickupLocation) {
    console.log(`Driver ${driverId} picking up order ${orderId}`);
    
    try {
      // Notify backend that driver arrived at store
      await deliveryService.arriveAtStore(orderId);
      
      // Simulate pickup delay (2-5 minutes)
      const pickupDelay = 2 + Math.random() * 3;
      
      setTimeout(async () => {
        try {
          // Update backend that order was picked up
          await deliveryService.pickupOrder(orderId);
          
          // Set driver status to en route to customer
          await deliveryService.enRouteToCustomer(orderId);
          
          console.log(`Driver ${driverId} completed pickup for order ${orderId}`);
        } catch (error) {
          console.error('Error updating pickup status:', error);
        }
      }, pickupDelay * 60 * 1000 / this.simulationSpeed);
      
    } catch (error) {
      console.error('Error simulating pickup:', error);
    }
  }

  async simulateDelivery(driverId, orderId, deliveryLocation) {
    console.log(`Driver ${driverId} delivering order ${orderId}`);
    
    try {
      // Simulate delivery delay (1-3 minutes)
      const deliveryDelay = 1 + Math.random() * 2;
      
      setTimeout(async () => {
        try {
          // Complete the delivery in backend
          await deliveryService.completeDelivery(orderId);
          
          console.log(`Driver ${driverId} completed delivery for order ${orderId}`);
        } catch (error) {
          console.error('Error completing delivery:', error);
        }
      }, deliveryDelay * 60 * 1000 / this.simulationSpeed);
      
    } catch (error) {
      console.error('Error simulating delivery:', error);
    }
  }

  simulateOrderSequence(driverId, orders) {
    if (!orders || orders.length === 0) return;
    
    // Create route from orders
    const route = [];
    orders.forEach(order => {
      route.push({
        type: 'pickup',
        location: order.store.location,
        orderId: order.id,
        name: order.store.name,
        address: order.store.address
      });
      route.push({
        type: 'delivery',
        location: order.customer.location,
        orderId: order.id,
        name: order.customer.name,
        address: order.customer.address
      });
    });
    
    this.updateDriverRoute(driverId, route);
  }

  // Utility Functions
  getDriverLocation(driverId) {
    const state = this.activeDrivers.get(driverId);
    return state ? {
      ...state.currentLocation,
      timestamp: state.lastUpdate
    } : null;
  }

  getAllDriverLocations() {
    const locations = new Map();
    this.activeDrivers.forEach((state, driverId) => {
      locations.set(driverId, {
        ...state.currentLocation,
        timestamp: state.lastUpdate
      });
    });
    return locations;
  }

  getDriverETA(driverId, destination) {
    const state = this.activeDrivers.get(driverId);
    if (!state) return null;
    
    const distance = calculateDistance(
      state.currentLocation.lat, state.currentLocation.lng,
      destination.lat, destination.lng
    );
    
    const timeHours = distance / state.speed;
    return new Date(Date.now() + timeHours * 60 * 60 * 1000);
  }

  isDriverAtLocation(driverId, targetLocation, toleranceMeters = 50) {
    const state = this.activeDrivers.get(driverId);
    if (!state) return false;
    
    const distanceMeters = calculateDistance(
      state.currentLocation.lat, state.currentLocation.lng,
      targetLocation.lat, targetLocation.lng
    ) * 1000;
    
    return distanceMeters <= toleranceMeters;
  }

  // Debug and Testing
  teleportDriver(driverId, location) {
    const state = this.activeDrivers.get(driverId);
    if (!state) return;
    
    state.currentLocation = { ...location };
    state.lastUpdate = new Date();
    
    this.broadcastLocationUpdate(driverId, state.currentLocation);
    console.log(`Teleported driver ${driverId} to`, location);
  }

  getMovementStats(driverId) {
    const state = this.activeDrivers.get(driverId);
    if (!state) return null;
    
    return {
      totalDistance: state.totalDistance,
      averageSpeed: state.speed,
      currentSpeed: state.speed,
      isMoving: state.isMoving,
      timeOnRoad: Date.now() - state.lastUpdate,
      routeProgress: state.route.length > 0 ? 
        (state.routeIndex / state.route.length) * 100 : 0
    };
  }

  // Additional utility methods
  getDriverState(driverId) {
    return this.activeDrivers.get(driverId);
  }

  setDriverIdleLocation(driverId, location) {
    const state = this.activeDrivers.get(driverId);
    if (state && state.isIdle) {
      state.currentLocation = { ...location };
      this.broadcastLocationUpdate(driverId, state.currentLocation);
    }
  }

  // New Delivery Route Methods
  async startDeliveryRoute(driverId, orderId, locations) {
    try {
      const state = this.activeDrivers.get(driverId);
      if (!state) {
        throw new Error(`Driver ${driverId} not found in active drivers`);
      }

      // Create delivery route: driver location -> store -> customer
      const route = [];
      
      // Add store as pickup location
      if (locations.storeLocation) {
        route.push({
          type: 'pickup',
          location: typeof locations.storeLocation === 'string' ? 
            this.parseLocationString(locations.storeLocation) : locations.storeLocation,
          orderId: orderId,
          name: 'Store Pickup',
          address: locations.storeLocation
        });
      }
      
      // Add customer as delivery location
      if (locations.customerLocation) {
        route.push({
          type: 'delivery',
          location: typeof locations.customerLocation === 'string' ? 
            this.parseLocationString(locations.customerLocation) : locations.customerLocation,
          orderId: orderId,
          name: 'Customer Delivery',
          address: locations.customerLocation
        });
      }

      // Update driver route
      this.updateDriverRoute(driverId, route);

      // Start delivery in backend
      await deliveryService.startDelivery(orderId, locations.storeLocation);

      console.log(`Started delivery route for driver ${driverId}, order ${orderId}`);
      return { success: true, route };
      
    } catch (error) {
      console.error('Error starting delivery route:', error);
      throw error;
    }
  }

  parseLocationString(locationString) {
    // Try to parse location string as JSON, fallback to Toronto coordinates
    try {
      return JSON.parse(locationString);
    } catch (error) {
      // If parsing fails, return default Toronto location
      return {
        lat: 43.6532 + (Math.random() - 0.5) * 0.1,
        lng: -79.3832 + (Math.random() - 0.5) * 0.1
      };
    }
  }
}

export default new DriverMovementService();

// Integration Tips:
/*
1. Movement Physics:
   - Use smooth interpolation between points
   - Maintain consistent speed (50 km/h constant)
   - Handle direction changes realistically

2. Route Following:
   - Break routes into small segments for smooth movement
   - Handle waypoint transitions smoothly
   - Consider road network constraints

3. Performance Optimization:
   - Limit update frequency (every 2-5 seconds)
   - Use efficient distance calculations
   - Batch location updates

4. Realistic Behavior:
   - Add small random variations to movement
   - Simulate stops at traffic lights/signs
   - Variable speeds based on road types

5. Map Integration:
   - Update Leaflet markers in real-time
   - Show driver trails/paths
   - Display speed and direction indicators
*/ 