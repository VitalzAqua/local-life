import L from 'leaflet';

// Simple icon creation using Leaflet's built-in methods
// This is much simpler than converting React icons to data URLs

const createIcon = (color, symbol, size = 25) => {
  return L.divIcon({
    className: 'custom-map-icon',
    html: `
      <div style="
        background: ${color};
        width: ${size}px;
        height: ${size}px;
        border-radius: 50% 50% 50% 0;
        border: 2px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${size * 0.6}px;
        color: white;
        font-weight: bold;
        transform: rotate(-45deg);
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      ">
        <span style="transform: rotate(45deg);">${symbol}</span>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size]
  });
};

// User location icon with different style
const createUserIcon = () => {
  return L.divIcon({
    className: 'user-location-icon',
    html: `
      <div style="
        background: #FF4444;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: 3px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        color: white;
        font-weight: bold;
        box-shadow: 0 3px 6px rgba(0,0,0,0.4);
        animation: pulse 2s infinite;
      ">
        📍
      </div>
      <style>
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
          100% { transform: scale(1); opacity: 1; }
        }
      </style>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15]
  });
};

// Category icons with consistent styling
export const createSimpleIcons = () => {
  return {
    restaurant: createIcon('#ff6b6b', '🍽️'),
    cafe: createIcon('#8b4513', '☕'),
    grocery: createIcon('#4CAF50', '🛒'),
    pharmacy: createIcon('#2196F3', '💊'),
    gym: createIcon('#9C27B0', '💪'),
    default: createIcon('#666666', '🏪'),
    user: createUserIcon()
  };
};

// Color mapping for consistency across the app
export const CATEGORY_COLORS = {
  restaurant: '#ff6b6b',
  cafe: '#8b4513',
  grocery: '#4CAF50',
  pharmacy: '#2196F3',
  gym: '#9C27B0',
  default: '#666666',
  user: '#FF4444'
};

// Icon symbols for use in other components
export const CATEGORY_SYMBOLS = {
  restaurant: '🍽️',
  cafe: '☕',
  grocery: '🛒',
  pharmacy: '💊',
  gym: '💪',
  default: '🏪',
  user: '📍'
}; 