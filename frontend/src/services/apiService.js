import axios from 'axios';
import { ENDPOINTS } from '../config/api';
import { getUserId } from '../utils/auth';

// Create axios instance with improved configuration
const apiClient = axios.create({
  baseURL: 'http://localhost:3001',
  timeout: 10000, // Reduced to 10 seconds for faster feedback
  headers: {
    'Content-Type': 'application/json',
  },
});

// Enhanced request interceptor with better logging
apiClient.interceptors.request.use(
  (config) => {
    console.log(`🌐 Making API request: ${config.method?.toUpperCase()} ${config.url}`);
    console.log(`🌐 Full URL: ${config.baseURL}${config.url}`);
    return config;
  },
  (error) => {
    console.log('🌐 Request setup error:', error);
    return Promise.reject(error);
  }
);

// Enhanced response interceptor with better error handling
apiClient.interceptors.response.use(
  (response) => {
    console.log(`✅ API Success: ${response.config.method?.toUpperCase()} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.log('🌐 API Error occurred:', error.message);
    console.log('🌐 Error code:', error.code);
    console.log('🌐 Error config:', error.config);
    
    // Check for specific error types
    if (error.code === 'ECONNABORTED') {
      console.log('🌐 Network error - please check your connection');
    } else if (error.response?.status === 408) {
      console.log('🌐 Server timeout - request took too long');
    } else if (error.response?.status === 503) {
      console.log('🌐 Database connection issue');
    } else if (!error.response) {
      console.log('🌐 Network error - please check your connection');
    }
    
    console.log('🌐 Request details:', error.request);
    return Promise.reject(error);
  }
);

// API Service class
class ApiService {
  // Auth services
  async login(credentials) {
    const response = await apiClient.post(ENDPOINTS.LOGIN, credentials);
    return response.data;
  }

  async register(userData) {
    const response = await apiClient.post(ENDPOINTS.REGISTER, userData);
    return response.data;
  }

  // Order services
  async createOrder(orderData) {
    const response = await apiClient.post(ENDPOINTS.ORDERS, orderData);
    return response.data;
  }

  async getUserOrders(userId) {
    const response = await apiClient.get(ENDPOINTS.USER_ORDERS(userId));
    return response.data;
  }

  // Get active deliveries with driver locations
  async getActiveDeliveries() {
    const response = await apiClient.get('/delivery/active');
    return response.data;
  }

  // Get drivers currently delivering orders for a specific user
  async getUserDeliveryDrivers(userId) {
    const orders = await this.getUserOrders(userId);
    
    // Extract driver IDs from orders that have active deliveries
    const activeDeliveryOrders = orders
      .filter(order => order.driver_id && order.delivery_status && 
              !['completed', 'cancelled', 'delivered'].includes(order.delivery_status));

    if (activeDeliveryOrders.length === 0) {
      return [];
    }

    // Get active deliveries with driver locations
    const activeDeliveries = await this.getActiveDeliveries();
    
    // Create driver objects by matching with active deliveries
    const drivers = activeDeliveryOrders.map(order => {
      // Find the corresponding active delivery
      const activeDelivery = activeDeliveries.find(delivery => 
        delivery.order_id === order.id && delivery.driver_id === order.driver_id
      );

      return {
        id: order.driver_id,
        name: order.driver_name || activeDelivery?.driver_name || `Driver ${order.driver_id}`,
        license_plate: order.driver_car,
        is_available: false, // They're delivering, so not available
        is_online: true,
        current_lat: activeDelivery?.current_lat || null,
        current_lng: activeDelivery?.current_lng || null,
        delivery_status: order.delivery_status,
        order_id: order.id,
        estimated_delivery_time: order.estimated_delivery_time,
        customer_location: order.customer_location,
        speed_kmh: activeDelivery?.speed_kmh || null
      };
    });

    // Remove duplicates in case a driver has multiple orders for the same user
    const uniqueDrivers = drivers.reduce((acc, driver) => {
      if (!acc.find(d => d.id === driver.id)) {
        acc.push(driver);
      }
      return acc;
    }, []);

    return uniqueDrivers;
  }

  // Get all drivers (admin only - requires password)
  async getAllDriversAdmin(password) {
    try {
      console.log('🔐 Fetching all drivers (admin)...');
      const response = await apiClient.get(`/delivery/drivers/admin/all?password=${encodeURIComponent(password)}`);
      console.log(`🔐 Admin view: Found ${response.data.length} total drivers`);
      return response.data;
    } catch (error) {
      console.error('🔐 Error fetching all drivers:', error);
      if (error.response?.status === 401) {
        throw new Error('Invalid admin password');
      }
      throw error;
    }
  }

  async getAllOrders() {
    const response = await apiClient.get(ENDPOINTS.ADMIN_ORDERS);
    return response.data;
  }

  async updateOrderStatus(orderId, status) {
    const response = await apiClient.patch(ENDPOINTS.ORDER_STATUS(orderId), { status });
    return response.data;
  }

  // Reservation services
  async createReservation(reservationData) {
    const response = await apiClient.post(ENDPOINTS.RESERVATIONS, reservationData);
    return response.data;
  }

  async getUserReservations(userId) {
    const response = await apiClient.get(ENDPOINTS.USER_RESERVATIONS(userId));
    return response.data;
  }

  async getAllReservations() {
    const response = await apiClient.get(ENDPOINTS.ADMIN_RESERVATIONS);
    return response.data;
  }

  async updateReservationStatus(reservationId, status) {
    const response = await apiClient.patch(ENDPOINTS.RESERVATION_STATUS(reservationId), { status });
    return response.data;
  }

  // User services
  async getAllUsers() {
    const response = await apiClient.get(ENDPOINTS.ADMIN_USERS);
    return response.data;
  }

  async getUserDetails(userId) {
    const response = await apiClient.get(ENDPOINTS.USER_DETAILS(userId));
    return response.data;
  }

  // Store/Category services
  async searchStores(query, categories = []) {
    const params = { q: query, categories: categories.join(',') };
    const response = await apiClient.get(ENDPOINTS.SEARCH, { params });
    return response.data;
  }

  async getNearbyStores(lat, lng, radius = 10, categories = []) {
    const params = { lat, lng, radius, categories: categories.join(',') };
    const response = await apiClient.get(ENDPOINTS.NEARBY_ALL, { params });
    return response.data;
  }

  // Get stores by categories only (no location required)
  async getStoresByCategories(categories = []) {
    const params = categories.length > 0 ? { categories: categories.join(',') } : {};
    const response = await apiClient.get(ENDPOINTS.NEARBY_ALL, { params });
    return response.data;
  }

  async getCategories() {
    try {
      console.log('🏷️ Fetching categories...');
      
      const response = await apiClient.get('/api/nearby/categories');
      
      console.log('🏷️ Categories API response:', response.data);
      return response.data;
      
    } catch (error) {
      console.log('🏷️ Error fetching categories:', error);
      console.log('🏷️ Error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        code: error.code
      });
      
      // Return empty array as fallback to prevent UI from breaking
      console.log('🏷️ Returning empty categories array as fallback');
      return [];
    }
  }

  // Delivery services
  async getAvailableDrivers() {
    const response = await apiClient.get(ENDPOINTS.DELIVERY_DRIVERS);
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

  // Saved locations services
  async getSavedLocations(userId) {
    const response = await apiClient.get(`/api/saved-locations/user/${userId}`);
    return response.data;
  }

  async saveLocation(locationData) {
    const response = await apiClient.post('/api/saved-locations', locationData);
    return response.data;
  }

  async updateSavedLocation(locationId, updateData) {
    const response = await apiClient.put(`/api/saved-locations/${locationId}`, updateData);
    return response.data;
  }

  async deleteSavedLocation(locationId, requestData) {
    const response = await apiClient.delete(`/api/saved-locations/${locationId}`, {
      data: requestData
    });
    return response.data;
  }

  async checkLocationSaved(userId, storeId) {
    const response = await apiClient.get(`/api/saved-locations/check/${userId}/${storeId}`);
    return response.data;
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

// Export individual named methods for convenience
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
  getStoresByCategories,
  getCategories,
  getAvailableDrivers,
  getActiveDeliveries,
  getSavedLocations,
  saveLocation,
  updateSavedLocation,
  deleteSavedLocation,
  checkLocationSaved
} = apiService; 