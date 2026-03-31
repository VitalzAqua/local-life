const DEFAULT_DEV_API_URL = 'http://localhost:3001';

const normalizeBaseUrl = (url = '') => String(url).trim().replace(/\/+$/, '');

const resolveApiBaseUrl = () => {
  const configuredBaseUrl = normalizeBaseUrl(process.env.REACT_APP_API_URL || '');

  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  // In production, default to same-origin requests so a static frontend can
  // talk to a backend mounted on the same host without hardcoding localhost.
  if (process.env.NODE_ENV === 'production') {
    return '';
  }

  return DEFAULT_DEV_API_URL;
};

const BASE_URL = resolveApiBaseUrl();

// API Configuration
const API_CONFIG = {
  BASE_URL,
  ENDPOINTS: {
    // Auth endpoints
    LOGIN: '/api/users/login',
    REGISTER: '/api/users/register',
    ADMIN_LOGIN: '/api/users/admin/login',
    
    // Orders endpoints
    ORDERS: '/api/orders',
    USER_ORDERS: (userId) => `/api/orders/user/${userId}`,
    ADMIN_ORDERS: '/api/orders/admin/all',
    ORDER_STATUS: (orderId) => `/api/orders/${orderId}/status`,
    
    // Reservations endpoints
    RESERVATIONS: '/api/reservations',
    USER_RESERVATIONS: (userId) => `/api/reservations/user/${userId}`,
    ADMIN_RESERVATIONS: '/api/reservations/admin/all',
    RESERVATION_STATUS: (reservationId) => `/api/reservations/${reservationId}/status`,
    
    // Users endpoints
    ADMIN_USERS: '/api/users/admin/all',
    USER_DETAILS: (userId) => `/api/users/admin/${userId}/details`,
    
    // Map/Search endpoints
    SEARCH: '/api/search',
    NEARBY_ALL: '/api/nearby/all',
    CATEGORIES: '/api/nearby/categories',

    // Delivery endpoints
    DELIVERY_DRIVERS: '/delivery/drivers/available',
    DELIVERY_ACTIVE: '/delivery/active',
    DELIVERY_DRIVERS_ALL: '/delivery/drivers',
    DELIVERY_DRIVERS_ADMIN: '/delivery/drivers/admin/all',

    // Saved locations endpoints
    SAVED_LOCATIONS: '/api/saved-locations',
    USER_SAVED_LOCATIONS: (userId) => `/api/saved-locations/user/${userId}`,
    SAVED_LOCATION: (id) => `/api/saved-locations/${id}`,
    CHECK_SAVED_LOCATION: (userId, storeId) => `/api/saved-locations/check/${userId}/${storeId}`,
  }
};

// Helper function to build full URL
export const buildApiUrl = (endpoint, params = {}) => {
  let url = `${API_CONFIG.BASE_URL}${endpoint}`;
  
  // Add query parameters if provided
  if (Object.keys(params).length > 0) {
    const queryString = new URLSearchParams(params).toString();
    url += `?${queryString}`;
  }
  
  return url;
};

// Export individual parts for convenience
export { BASE_URL };
export const { ENDPOINTS } = API_CONFIG;
export default API_CONFIG; 
