import L from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import { 
  MdRestaurant,
  MdLocalCafe, 
  MdLocalGroceryStore,
  MdLocalPharmacy,
  MdFitnessCenter,
  MdLocationOn,
  MdStore
} from 'react-icons/md';

// Function to create a data URL from a React Icon component
const createIconDataUrl = (IconComponent, color = '#333333', size = 20) => {
  const iconSvg = renderToStaticMarkup(
    IconComponent({ size, color, style: { display: 'block' } })
  );
  return `data:image/svg+xml;base64,${btoa(iconSvg)}`;
};

// Create icons for each category
export const createCategoryIcons = () => {
  return {
    restaurant: new L.Icon({
      iconUrl: createIconDataUrl(MdRestaurant, '#ff6b6b', 20),
      iconSize: [20, 20],
      iconAnchor: [10, 20],
      popupAnchor: [0, -20],
      className: 'custom-leaflet-icon'
    }),
    cafe: new L.Icon({
      iconUrl: createIconDataUrl(MdLocalCafe, '#8b4513', 20),
      iconSize: [20, 20],
      iconAnchor: [10, 20],
      popupAnchor: [0, -20],
      className: 'custom-leaflet-icon'
    }),
    grocery: new L.Icon({
      iconUrl: createIconDataUrl(MdLocalGroceryStore, '#4CAF50', 20),
      iconSize: [20, 20],
      iconAnchor: [10, 20],
      popupAnchor: [0, -20],
      className: 'custom-leaflet-icon'
    }),
    pharmacy: new L.Icon({
      iconUrl: createIconDataUrl(MdLocalPharmacy, '#2196F3', 20),
      iconSize: [20, 20],
      iconAnchor: [10, 20],
      popupAnchor: [0, -20],
      className: 'custom-leaflet-icon'
    }),
    gym: new L.Icon({
      iconUrl: createIconDataUrl(MdFitnessCenter, '#9C27B0', 20),
      iconSize: [20, 20],
      iconAnchor: [10, 20],
      popupAnchor: [0, -20],
      className: 'custom-leaflet-icon'
    }),
    default: new L.Icon({
      iconUrl: createIconDataUrl(MdStore, '#666666', 20),
      iconSize: [20, 20],
      iconAnchor: [10, 20],
      popupAnchor: [0, -20],
      className: 'custom-leaflet-icon'
    }),
    userLocation: new L.Icon({
      iconUrl: createIconDataUrl(MdLocationOn, '#FF4444', 28),
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -28],
      className: 'custom-leaflet-icon user-location'
    })
  };
};

// Export individual icon components for use in other parts of the app
export const CategoryIcons = {
  restaurant: MdRestaurant,
  cafe: MdLocalCafe,
  grocery: MdLocalGroceryStore,
  pharmacy: MdLocalPharmacy,
  gym: MdFitnessCenter,
  default: MdStore,
  userLocation: MdLocationOn
};

// Color scheme for categories
export const CategoryColors = {
  restaurant: '#ff6b6b',
  cafe: '#8b4513', 
  grocery: '#4CAF50',
  pharmacy: '#2196F3',
  gym: '#9C27B0',
  default: '#666666',
  userLocation: '#FF4444'
}; 