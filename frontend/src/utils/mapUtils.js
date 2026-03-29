import L from 'leaflet';

/**
 * Distance between two points in kilometers (Leaflet).
 * Supports ([lat, lng], [lat, lng]) or (lat1, lng1, lat2, lng2).
 */
export const calculateDistance = (latlng1, latlng2, lat2, lng2) => {
  let point1;
  let point2;

  if (Array.isArray(latlng1) && Array.isArray(latlng2)) {
    point1 = L.latLng(latlng1);
    point2 = L.latLng(latlng2);
  } else if (
    typeof latlng1 === 'number' &&
    typeof latlng2 === 'number' &&
    typeof lat2 === 'number' &&
    typeof lng2 === 'number'
  ) {
    point1 = L.latLng(latlng1, latlng2);
    point2 = L.latLng(lat2, lng2);
  } else {
    throw new Error('Invalid parameters for calculateDistance');
  }

  return point1.distanceTo(point2) / 1000;
};
