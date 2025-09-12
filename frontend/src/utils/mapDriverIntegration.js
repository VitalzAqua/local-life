// Map Driver Integration - Utilities for displaying drivers and routes on the map
// Handles driver markers, route visualization, and real-time updates

import L from 'leaflet';

class MapDriverIntegration {
  constructor(map) {
    this.map = map;
    this.driverMarkers = new Map(); // Map<driverId, marker>
    this.routePolylines = new Map(); // Map<driverId, polyline>
    this.orderMarkers = new Map(); // Map<orderId, { pickup: marker, delivery: marker }>
    this.driverTrails = new Map(); // Map<driverId, polyline[]> for movement trails
    
    this.driverIcon = this.createDriverIcon();
    this.pickupIcon = this.createPickupIcon();
    this.deliveryIcon = this.createDeliveryIcon();
  }

  // Icon Creation
  createDriverIcon(status = 'available') {
    const iconColors = {
      available: '#28a745',
      busy: '#ffc107',
      offline: '#6c757d',
      returning: '#17a2b8'
    };

    return L.divIcon({
      className: 'driver-marker',
      html: `
        <div class="driver-icon" style="background-color: ${iconColors[status]}; 
                                       width: 30px; height: 30px; border-radius: 50%; 
                                       display: flex; align-items: center; justify-content: center;
                                       border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                                       color: white; font-size: 14px;">
          🚗
        </div>
      `,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });
  }

  createPickupIcon() {
    return L.divIcon({
      className: 'pickup-marker',
      html: `
        <div class="pickup-icon" style="background-color: #007bff; 
                                        width: 25px; height: 25px; border-radius: 4px;
                                        display: flex; align-items: center; justify-content: center;
                                        border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                                        color: white; font-size: 12px;">
          📦
        </div>
      `,
      iconSize: [25, 25],
      iconAnchor: [12.5, 12.5]
    });
  }

  createDeliveryIcon() {
    return L.divIcon({
      className: 'delivery-marker',
      html: `
        <div class="delivery-icon" style="background-color: #28a745; 
                                          width: 25px; height: 25px; border-radius: 4px;
                                          display: flex; align-items: center; justify-content: center;
                                          border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                                          color: white; font-size: 12px;">
          🏠
        </div>
      `,
      iconSize: [25, 25],
      iconAnchor: [12.5, 12.5]
    });
  }

  // Driver Marker Management
  addDriver(driver) {
    if (!driver.location || !driver.location.lat || !driver.location.lng) {
      console.warn(`Driver ${driver.id} has no valid location`);
      return;
    }

    const marker = L.marker([driver.location.lat, driver.location.lng], {
      icon: this.createDriverIcon(driver.status)
    }).addTo(this.map);

    // Create popup with driver information
    const popupContent = this.createDriverPopup(driver);
    marker.bindPopup(popupContent);

    // Store marker reference
    this.driverMarkers.set(driver.id, marker);

    // Initialize trail for this driver
    this.driverTrails.set(driver.id, []);

    return marker;
  }

  updateDriverLocation(driverId, newLocation, bearing = null) {
    const marker = this.driverMarkers.get(driverId);
    if (!marker) return;

    const oldLatLng = marker.getLatLng();
    const newLatLng = L.latLng(newLocation.lat, newLocation.lng);

    // Animate marker movement
    this.animateMarkerMovement(marker, oldLatLng, newLatLng);

    // Update marker rotation if bearing is provided
    if (bearing !== null) {
      this.rotateMarker(marker, bearing);
    }

    // Add to trail
    this.addToDriverTrail(driverId, newLatLng);

    return marker;
  }

  updateDriverStatus(driverId, status) {
    const marker = this.driverMarkers.get(driverId);
    if (!marker) return;

    marker.setIcon(this.createDriverIcon(status));
  }

  removeDriver(driverId) {
    const marker = this.driverMarkers.get(driverId);
    if (marker) {
      this.map.removeLayer(marker);
      this.driverMarkers.delete(driverId);
    }

    // Remove route if exists
    this.removeDriverRoute(driverId);

    // Remove trail
    this.clearDriverTrail(driverId);
  }

  // Route Visualization
  displayDriverRoute(driverId, waypoints, options = {}) {
    const defaultOptions = {
      color: '#007bff',
      weight: 4,
      opacity: 0.8,
      dashArray: '10, 5'
    };

    const routeOptions = { ...defaultOptions, ...options };

    // Remove existing route
    this.removeDriverRoute(driverId);

    if (!waypoints || waypoints.length === 0) {
      return null;
    }

    // Create route polyline
    const latLngs = waypoints.map(wp => [wp.lat, wp.lng]);
    const polyline = L.polyline(latLngs, routeOptions).addTo(this.map);

    // Add waypoint markers
    waypoints.forEach((waypoint, index) => {
      const icon = waypoint.type === 'pickup' ? this.pickupIcon : this.deliveryIcon;
      const marker = L.marker([waypoint.lat, waypoint.lng], { icon }).addTo(this.map);
      
      // Add popup with order information
      marker.bindPopup(this.createWaypointPopup(waypoint, index + 1));
    });

    this.routePolylines.set(driverId, polyline);
    return polyline;
  }

  removeDriverRoute(driverId) {
    const polyline = this.routePolylines.get(driverId);
    if (polyline) {
      this.map.removeLayer(polyline);
      this.routePolylines.delete(driverId);
    }
  }

  // Order Visualization
  displayOrder(order) {
    const pickupMarker = L.marker(
      [order.store.location.lat, order.store.location.lng],
      { icon: this.pickupIcon }
    ).addTo(this.map);

    const deliveryMarker = L.marker(
      [order.customer.location.lat, order.customer.location.lng],
      { icon: this.deliveryIcon }
    ).addTo(this.map);

    // Connect pickup and delivery with a line
    const connectionLine = L.polyline([
      [order.store.location.lat, order.store.location.lng],
      [order.customer.location.lat, order.customer.location.lng]
    ], {
      color: '#dc3545',
      weight: 2,
      opacity: 0.6,
      dashArray: '5, 5'
    }).addTo(this.map);

    // Store markers
    this.orderMarkers.set(order.id, {
      pickup: pickupMarker,
      delivery: deliveryMarker,
      connection: connectionLine
    });

    // Add popups
    pickupMarker.bindPopup(this.createPickupPopup(order));
    deliveryMarker.bindPopup(this.createDeliveryPopup(order));

    return { pickupMarker, deliveryMarker, connectionLine };
  }

  removeOrder(orderId) {
    const markers = this.orderMarkers.get(orderId);
    if (markers) {
      this.map.removeLayer(markers.pickup);
      this.map.removeLayer(markers.delivery);
      this.map.removeLayer(markers.connection);
      this.orderMarkers.delete(orderId);
    }
  }

  // Animation and Visual Effects
  animateMarkerMovement(marker, fromLatLng, toLatLng, duration = 2000) {
    const startTime = performance.now();
    
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation
      const easeProgress = this.easeInOutQuad(progress);
      
      // Interpolate position
      const currentLat = fromLatLng.lat + (toLatLng.lat - fromLatLng.lat) * easeProgress;
      const currentLng = fromLatLng.lng + (toLatLng.lng - fromLatLng.lng) * easeProgress;
      
      marker.setLatLng([currentLat, currentLng]);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }

  rotateMarker(marker, bearing) {
    const element = marker.getElement();
    if (element) {
      const driverIcon = element.querySelector('.driver-icon');
      if (driverIcon) {
        driverIcon.style.transform = `rotate(${bearing}deg)`;
        driverIcon.style.transition = 'transform 0.3s ease';
      }
    }
  }

  // Trail Management
  addToDriverTrail(driverId, latLng) {
    const trail = this.driverTrails.get(driverId) || [];
    trail.push(latLng);
    
    // Limit trail length to prevent memory issues
    const maxTrailLength = 50;
    if (trail.length > maxTrailLength) {
      trail.shift(); // Remove oldest point
    }
    
    this.driverTrails.set(driverId, trail);
    this.updateTrailVisualization(driverId);
  }

  updateTrailVisualization(driverId) {
    // For now, we don't visualize trails to keep the map clean
    // This could be implemented as an optional feature
  }

  clearDriverTrail(driverId) {
    this.driverTrails.delete(driverId);
  }

  // Popup Content Creation
  createDriverPopup(driver) {
    return `
      <div class="driver-popup">
        <h4>${driver.name}</h4>
        <p><strong>Status:</strong> ${driver.status}</p>
        <p><strong>Vehicle:</strong> ${driver.vehicle.type} - ${driver.vehicle.licensePlate}</p>
        <p><strong>Orders:</strong> ${driver.currentOrders.length}/${driver.maxOrders}</p>
        <p><strong>Speed:</strong> ${driver.speed} km/h</p>
        ${driver.workingHours ? `
          <p><strong>Working Hours:</strong> ${driver.workingHours.start} - ${driver.workingHours.end}</p>
        ` : ''}
      </div>
    `;
  }

  createWaypointPopup(waypoint, sequence) {
    return `
      <div class="waypoint-popup">
        <h4>Stop #${sequence}</h4>
        <p><strong>Type:</strong> ${waypoint.type === 'pickup' ? 'Pickup' : 'Delivery'}</p>
        <p><strong>Order:</strong> #${waypoint.orderId}</p>
        <p><strong>Location:</strong> ${waypoint.name}</p>
        ${waypoint.address ? `<p><strong>Address:</strong> ${waypoint.address}</p>` : ''}
      </div>
    `;
  }

  createPickupPopup(order) {
    return `
      <div class="pickup-popup">
        <h4>📦 Pickup Location</h4>
        <p><strong>Store:</strong> ${order.store.name}</p>
        <p><strong>Address:</strong> ${order.store.address}</p>
        <p><strong>Order:</strong> #${order.id}</p>
        <p><strong>Priority:</strong> ${order.priority}</p>
        <p><strong>Items:</strong> ${order.items.length} item(s)</p>
      </div>
    `;
  }

  createDeliveryPopup(order) {
    return `
      <div class="delivery-popup">
        <h4>🏠 Delivery Location</h4>
        <p><strong>Customer:</strong> ${order.customer.name}</p>
        <p><strong>Address:</strong> ${order.customer.address}</p>
        <p><strong>Phone:</strong> ${order.customer.phone}</p>
        <p><strong>Order:</strong> #${order.id}</p>
        <p><strong>Priority:</strong> ${order.priority}</p>
        ${order.estimatedDelivery ? `
          <p><strong>ETA:</strong> ${new Date(order.estimatedDelivery).toLocaleTimeString()}</p>
        ` : ''}
      </div>
    `;
  }

  // Utility Functions
  easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  focusOnDriver(driverId, zoom = 16) {
    const marker = this.driverMarkers.get(driverId);
    if (marker) {
      this.map.setView(marker.getLatLng(), zoom);
    }
  }

  getAllDriverPositions() {
    const positions = new Map();
    this.driverMarkers.forEach((marker, driverId) => {
      positions.set(driverId, marker.getLatLng());
    });
    return positions;
  }

  fitBoundsToDrivers() {
    const positions = Array.from(this.driverMarkers.values()).map(marker => marker.getLatLng());
    
    if (positions.length === 0) return;
    
    if (positions.length === 1) {
      this.map.setView(positions[0], 14);
    } else {
      const bounds = L.latLngBounds(positions);
      this.map.fitBounds(bounds, { padding: [20, 20] });
    }
  }

  // Advanced Features
  highlightDriver(driverId, highlight = true) {
    const marker = this.driverMarkers.get(driverId);
    if (!marker) return;

    const element = marker.getElement();
    if (element) {
      const driverIcon = element.querySelector('.driver-icon');
      if (driverIcon) {
        if (highlight) {
          driverIcon.style.transform = 'scale(1.3)';
          driverIcon.style.boxShadow = '0 0 15px rgba(255, 215, 0, 0.8)';
          driverIcon.style.border = '3px solid #ffd700';
        } else {
          driverIcon.style.transform = 'scale(1)';
          driverIcon.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
          driverIcon.style.border = '3px solid white';
        }
        driverIcon.style.transition = 'all 0.3s ease';
      }
    }
  }

  showDriverDetails(driverId) {
    const marker = this.driverMarkers.get(driverId);
    if (marker) {
      marker.openPopup();
      this.focusOnDriver(driverId, 16);
    }
  }

  hideAllRoutes() {
    this.routePolylines.forEach((polyline, driverId) => {
      this.removeDriverRoute(driverId);
    });
  }

  showAllDrivers() {
    this.driverMarkers.forEach(marker => {
      marker.addTo(this.map);
    });
  }

  hideAllDrivers() {
    this.driverMarkers.forEach(marker => {
      this.map.removeLayer(marker);
    });
  }

  // Distance and Direction Helpers
  getDistanceToDriver(driverId, targetLatLng) {
    const marker = this.driverMarkers.get(driverId);
    if (!marker) return null;

    return marker.getLatLng().distanceTo(targetLatLng);
  }

  getNearestDriver(targetLatLng) {
    let nearestDriver = null;
    let minDistance = Infinity;

    this.driverMarkers.forEach((marker, driverId) => {
      const distance = marker.getLatLng().distanceTo(targetLatLng);
      if (distance < minDistance) {
        minDistance = distance;
        nearestDriver = { driverId, distance, position: marker.getLatLng() };
      }
    });

    return nearestDriver;
  }

  // Route Analytics
  calculateRouteDistance(waypoints) {
    if (!waypoints || waypoints.length < 2) return 0;

    let totalDistance = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      const from = L.latLng(waypoints[i].lat, waypoints[i].lng);
      const to = L.latLng(waypoints[i + 1].lat, waypoints[i + 1].lng);
      totalDistance += from.distanceTo(to);
    }

    return totalDistance / 1000; // Convert to kilometers
  }

  // Cleanup
  cleanup() {
    // Remove all markers and polylines
    this.driverMarkers.forEach(marker => {
      this.map.removeLayer(marker);
    });
    
    this.routePolylines.forEach(polyline => {
      this.map.removeLayer(polyline);
    });
    
    this.orderMarkers.forEach(markers => {
      this.map.removeLayer(markers.pickup);
      this.map.removeLayer(markers.delivery);
      this.map.removeLayer(markers.connection);
    });

    // Clear all data structures
    this.driverMarkers.clear();
    this.routePolylines.clear();
    this.orderMarkers.clear();
    this.driverTrails.clear();
  }

  // Event Handlers
  onDriverClick(callback) {
    this.driverMarkers.forEach((marker, driverId) => {
      marker.on('click', () => callback(driverId));
    });
  }

  onDriverRightClick(callback) {
    this.driverMarkers.forEach((marker, driverId) => {
      marker.on('contextmenu', () => callback(driverId));
    });
  }

  // Batch Operations
  updateMultipleDrivers(driverUpdates) {
    driverUpdates.forEach(update => {
      if (update.location) {
        this.updateDriverLocation(update.driverId, update.location, update.bearing);
      }
      if (update.status) {
        this.updateDriverStatus(update.driverId, update.status);
      }
    });
  }

  displayMultipleOrders(orders) {
    orders.forEach(order => {
      this.displayOrder(order);
    });
  }

  removeMultipleOrders(orderIds) {
    orderIds.forEach(orderId => {
      this.removeOrder(orderId);
    });
  }
}

export default MapDriverIntegration;

// Usage Example:
/*
const mapIntegration = new MapDriverIntegration(leafletMap);

// Add drivers
drivers.forEach(driver => mapIntegration.addDriver(driver));

// Display routes
mapIntegration.displayDriverRoute(driverId, waypoints);

// Update driver location in real-time
mapIntegration.updateDriverLocation(driverId, newLocation, bearing);

// Focus on specific driver
mapIntegration.focusOnDriver(driverId);

// Cleanup when component unmounts
mapIntegration.cleanup();
*/ 