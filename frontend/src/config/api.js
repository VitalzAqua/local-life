// API Configuration
const API_CONFIG = {
  BASE_URL: process.env.REACT_APP_API_URL || 'http://localhost:3001',
  ENDPOINTS: {
    // Auth endpoints
    LOGIN: '/api/users/login',
    REGISTER: '/api/users/register',
    
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
    DELIVERY_DRIVERS: '/api/delivery/drivers/available',
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
export const { BASE_URL, ENDPOINTS } = API_CONFIG;
export default API_CONFIG; 