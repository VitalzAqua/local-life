import L from 'leaflet';

/**
 * Calculate distance between two coordinates using Leaflet's built-in method
 * @param {Array|number} latlng1 - [latitude, longitude] of first point OR latitude as number
 * @param {Array|number} latlng2 - [latitude, longitude] of second point OR longitude as number
 * @param {number} lat2 - Optional: latitude of second point if using individual parameters
 * @param {number} lng2 - Optional: longitude of second point if using individual parameters
 * @returns {number} Distance in kilometers
 */
export const calculateDistance = (latlng1, latlng2, lat2, lng2) => {
  // Handle both array format [lat, lng] and individual parameter format (lat, lng, lat2, lng2)
  let point1, point2;
  
  if (Array.isArray(latlng1) && Array.isArray(latlng2)) {
    // Array format: calculateDistance([lat1, lng1], [lat2, lng2])
    point1 = L.latLng(latlng1);
    point2 = L.latLng(latlng2);
  } else if (typeof latlng1 === 'number' && typeof latlng2 === 'number' && 
             typeof lat2 === 'number' && typeof lng2 === 'number') {
    // Individual parameter format: calculateDistance(lat1, lng1, lat2, lng2)
    point1 = L.latLng(latlng1, latlng2);
    point2 = L.latLng(lat2, lng2);
  } else {
    throw new Error('Invalid parameters for calculateDistance');
  }
  
  return point1.distanceTo(point2) / 1000; // Convert to km
};

/**
 * Calculate travel time between two points
 * @param {number} lat1 - Latitude of first point
 * @param {number} lng1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lng2 - Longitude of second point
 * @param {number} speed - Speed in km/h (default: 50)
 * @returns {number} Travel time in minutes
 */
export const calculateTravelTime = (lat1, lng1, lat2, lng2, speed = 50) => {
  const distance = calculateDistance(lat1, lng1, lat2, lng2);
  return (distance / speed) * 60; // Convert hours to minutes
};

/**
 * Calculate bearing between two points
 * @param {number} lat1 - Latitude of first point
 * @param {number} lng1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lng2 - Longitude of second point
 * @returns {number} Bearing in degrees (0-360)
 */
export const calculateBearing = (lat1, lng1, lat2, lng2) => {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  
  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  
  const bearingRad = Math.atan2(y, x);
  const bearingDeg = (bearingRad * 180 / Math.PI + 360) % 360;
  
  return bearingDeg;
};

/**
 * Get a point at a specific distance and bearing from a starting point
 * @param {number} lat - Starting latitude
 * @param {number} lng - Starting longitude
 * @param {number} distance - Distance in kilometers
 * @param {number} bearing - Bearing in degrees
 * @returns {Object} Object with lat and lng properties
 */
export const getPointAtDistance = (lat, lng, distance, bearing) => {
  const R = 6371; // Earth's radius in km
  const bearingRad = bearing * Math.PI / 180;
  const latRad = lat * Math.PI / 180;
  const lngRad = lng * Math.PI / 180;
  
  const lat2Rad = Math.asin(
    Math.sin(latRad) * Math.cos(distance / R) + 
    Math.cos(latRad) * Math.sin(distance / R) * Math.cos(bearingRad)
  );
  
  const lng2Rad = lngRad + Math.atan2(
    Math.sin(bearingRad) * Math.sin(distance / R) * Math.cos(latRad),
    Math.cos(distance / R) - Math.sin(latRad) * Math.sin(lat2Rad)
  );
  
  return {
    lat: lat2Rad * 180 / Math.PI,
    lng: lng2Rad * 180 / Math.PI
  };
};

/**
 * Interpolate between two points
 * @param {number} lat1 - Latitude of first point
 * @param {number} lng1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lng2 - Longitude of second point
 * @param {number} progress - Progress between 0 and 1
 * @returns {Object} Object with lat and lng properties
 */
export const interpolatePoint = (lat1, lng1, lat2, lng2, progress) => {
  const lat = lat1 + (lat2 - lat1) * progress;
  const lng = lng1 + (lng2 - lng1) * progress;
  return { lat, lng };
};

/**
 * Generate a route polyline between multiple points
 * @param {Array} points - Array of {lat, lng} objects
 * @returns {Array} Array of [lat, lng] arrays for polyline
 */
export const generateRoutePolyline = (points) => {
  if (!points || points.length < 2) return [];
  
  const polyline = [];
  
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    
    // Add intermediate points for smooth line
    const steps = 10;
    for (let j = 0; j <= steps; j++) {
      const progress = j / steps;
      const interpolated = interpolatePoint(start.lat, start.lng, end.lat, end.lng, progress);
      polyline.push([interpolated.lat, interpolated.lng]);
    }
  }
  
  return polyline;
};

/**
 * Check if a coordinate is within Toronto boundaries
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {boolean} True if within Toronto boundaries
 */
export const isWithinToronto = (lat, lng) => {
  const TORONTO_BOUNDS = {
    NORTH: 43.855,
    SOUTH: 43.581,
    EAST: -79.116,
    WEST: -79.639
  };
  
  return lat >= TORONTO_BOUNDS.SOUTH && 
         lat <= TORONTO_BOUNDS.NORTH && 
         lng >= TORONTO_BOUNDS.WEST && 
         lng <= TORONTO_BOUNDS.EAST;
};

/**
 * Format distance for display
 * @param {number} distance - Distance in kilometers
 * @returns {string} Formatted distance string
 */
export const formatDistance = (distance) => {
  if (distance < 1) {
    return `${Math.round(distance * 1000)}m`;
  }
  return `${distance.toFixed(1)}km`;
};

/**
 * Format travel time for display
 * @param {number} minutes - Time in minutes
 * @returns {string} Formatted time string
 */
export const formatTravelTime = (minutes) => {
  if (minutes < 60) {
    return `${Math.round(minutes)}min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  return `${hours}h ${remainingMinutes}min`;
};

/**
 * Create a bounds object from an array of coordinates
 * @param {Array} coordinates - Array of [lat, lng] arrays
 * @returns {L.LatLngBounds} Leaflet bounds object
 */
export const createBounds = (coordinates) => {
  if (!coordinates || coordinates.length === 0) return null;
  
  const group = new L.featureGroup(
    coordinates.map(coord => L.marker(coord))
  );
  
  return group.getBounds();
};

/**
 * Get the center point of multiple coordinates
 * @param {Array} coordinates - Array of [lat, lng] arrays
 * @returns {Array} [lat, lng] of center point
 */
export const getCenterPoint = (coordinates) => {
  if (!coordinates || coordinates.length === 0) return null;
  
  const bounds = createBounds(coordinates);
  if (!bounds) return null;
  
  const center = bounds.getCenter();
  return [center.lat, center.lng];
};

/**
 * Sort locations by distance from a reference point
 * @param {Array} locations - Array of locations with lat/lng properties
 * @param {Object} referencePoint - Object with lat/lng properties
 * @returns {Array} Sorted array of locations with distance property added
 */
export const sortByDistance = (locations, referencePoint) => {
  if (!referencePoint || !locations) return locations;
  
  return locations
    .map(location => ({
      ...location,
      distance: calculateDistance(
        [referencePoint.lat, referencePoint.lng],
        [location.lat, location.lng]
      )
    }))
    .sort((a, b) => a.distance - b.distance);
};

/**
 * Filter locations within a certain radius
 * @param {Array} locations - Array of locations with lat/lng properties
 * @param {Object} centerPoint - Object with lat/lng properties
 * @param {number} radiusKm - Radius in kilometers
 * @returns {Array} Filtered array of locations
 */
export const filterByRadius = (locations, centerPoint, radiusKm) => {
  if (!centerPoint || !locations || radiusKm <= 0) return locations;
  
  return locations.filter(location => {
    const distance = calculateDistance(
      [centerPoint.lat, centerPoint.lng],
      [location.lat, location.lng]
    );
    return distance <= radiusKm;
  });
};

/**
 * Get optimal zoom level based on distance
 * @param {number} distance - Distance in kilometers
 * @returns {number} Optimal zoom level
 */
export const getOptimalZoom = (distance) => {
  if (distance < 1) return 16;
  if (distance < 5) return 14;
  if (distance < 10) return 13;
  if (distance < 20) return 12;
  if (distance < 50) return 11;
  return 10;
};

/**
 * Validate coordinates
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {boolean} True if coordinates are valid
 */
export const isValidCoordinate = (lat, lng) => {
  return !isNaN(lat) && !isNaN(lng) && 
         lat >= -90 && lat <= 90 && 
         lng >= -180 && lng <= 180;
};

/**
 * Calculate estimated time of arrival
 * @param {number} travelTimeMinutes - Travel time in minutes
 * @param {Date} startTime - Start time (default: now)
 * @returns {Date} Estimated arrival time
 */
export const calculateETA = (travelTimeMinutes, startTime = new Date()) => {
  return new Date(startTime.getTime() + travelTimeMinutes * 60 * 1000);
};

/**
 * Generate random coordinates within Toronto
 * @returns {Object} Object with lat and lng properties
 */
export const generateRandomTorontoCoordinate = () => {
  const TORONTO_BOUNDS = {
    NORTH: 43.855,
    SOUTH: 43.581,
    EAST: -79.116,
    WEST: -79.639
  };
  
  const lat = TORONTO_BOUNDS.SOUTH + Math.random() * (TORONTO_BOUNDS.NORTH - TORONTO_BOUNDS.SOUTH);
  const lng = TORONTO_BOUNDS.WEST + Math.random() * (TORONTO_BOUNDS.EAST - TORONTO_BOUNDS.WEST);
  
  return { lat, lng };
}; 