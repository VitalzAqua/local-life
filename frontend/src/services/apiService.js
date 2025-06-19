import axios from 'axios';
import { buildApiUrl, ENDPOINTS } from '../config/api';
import { getUserId } from '../utils/auth';

// Create axios instance with default config
const apiClient = axios.create({
  timeout: 10000, // 10 second timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth headers if needed
apiClient.interceptors.request.use(
  (config) => {
    // Add any common headers here
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling common errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle common HTTP errors
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      
      switch (status) {
        case 401:
          console.error('Unauthorized access - please log in');
          break;
        case 403:
          console.error('Forbidden - insufficient permissions');
          break;
        case 404:
          console.error('Resource not found');
          break;
        case 500:
          console.error('Server error - please try again later');
          break;
        default:
          console.error(`HTTP Error ${status}:`, data?.error || error.message);
      }
    } else if (error.request) {
      // Network error
      console.error('Network error - please check your connection');
    } else {
      console.error('Request error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// API Service class
class ApiService {
  // Auth services
  async login(credentials) {
    const response = await apiClient.post(buildApiUrl(ENDPOINTS.LOGIN), credentials);
    return response.data;
  }

  async register(userData) {
    const response = await apiClient.post(buildApiUrl(ENDPOINTS.REGISTER), userData);
    return response.data;
  }

  // Order services
  async createOrder(orderData) {
    const response = await apiClient.post(buildApiUrl(ENDPOINTS.ORDERS), orderData);
    return response.data;
  }

  async getUserOrders(userId) {
    const response = await apiClient.get(buildApiUrl(ENDPOINTS.USER_ORDERS(userId)));
    return response.data;
  }

  async getAllOrders() {
    const response = await apiClient.get(buildApiUrl(ENDPOINTS.ADMIN_ORDERS));
    return response.data;
  }

  async updateOrderStatus(orderId, status) {
    const response = await apiClient.patch(buildApiUrl(ENDPOINTS.ORDER_STATUS(orderId)), { status });
    return response.data;
  }

  // Reservation services
  async createReservation(reservationData) {
    const response = await apiClient.post(buildApiUrl(ENDPOINTS.RESERVATIONS), reservationData);
    return response.data;
  }

  async getUserReservations(userId) {
    const response = await apiClient.get(buildApiUrl(ENDPOINTS.USER_RESERVATIONS(userId)));
    return response.data;
  }

  async getAllReservations() {
    const response = await apiClient.get(buildApiUrl(ENDPOINTS.ADMIN_RESERVATIONS));
    return response.data;
  }

  async updateReservationStatus(reservationId, status) {
    const response = await apiClient.patch(buildApiUrl(ENDPOINTS.RESERVATION_STATUS(reservationId)), { status });
    return response.data;
  }

  // User services
  async getAllUsers() {
    const response = await apiClient.get(buildApiUrl(ENDPOINTS.ADMIN_USERS));
    return response.data;
  }

  async getUserDetails(userId) {
    const response = await apiClient.get(buildApiUrl(ENDPOINTS.USER_DETAILS(userId)));
    return response.data;
  }

  // Map/Search services
  async searchStores(query, categories = []) {
    const params = { q: query };
    if (categories.length > 0) {
      params.categories = categories.join(',');
    }
    const response = await apiClient.get(buildApiUrl(ENDPOINTS.SEARCH, params));
    return response.data;
  }

  async getNearbyStores(categories = []) {
    const params = categories.length > 0 ? { categories: categories.join(',') } : {};
    const response = await apiClient.get(buildApiUrl(ENDPOINTS.NEARBY_ALL, params));
    return response.data;
  }

  async getCategories() {
    const response = await apiClient.get(buildApiUrl(ENDPOINTS.CATEGORIES));
    return response.data;
  }

  // Delivery services
  async getAvailableDrivers() {
    const response = await apiClient.get(buildApiUrl(ENDPOINTS.DELIVERY_DRIVERS));
    return response.data;
  }

  async checkDeliveryAvailability() {
    try {
      const drivers = await this.getAvailableDrivers();
      return drivers.length > 0;
    } catch (error) {
      console.error('Error checking delivery availability:', error);
      return false;
    }
  }

  // Helper method for user-specific requests with automatic user ID resolution
  async makeUserRequest(requestFn, user = null) {
    const userId = getUserId(user);
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return requestFn(userId);
  }
}

// Export singleton instance
const apiService = new ApiService();
export default apiService;

// Export individual methods for convenience
export const {
  login,
  register,
  createOrder,
  getUserOrders,
  getAllOrders,
  updateOrderStatus,
  createReservation,
  getUserReservations,
  getAllReservations,
  updateReservationStatus,
  getAllUsers,
  getUserDetails,
  searchStores,
  getNearbyStores,
  getCategories,
  makeUserRequest
} = apiService; 