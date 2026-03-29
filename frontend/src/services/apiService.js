import axios from 'axios';
import { ENDPOINTS } from '../config/api';

// Create axios instance with improved configuration
const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error(`API error: ${error.config?.method?.toUpperCase()} ${error.config?.url}`, error.message);
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

  async getActiveDeliveries() {
    const response = await apiClient.get(ENDPOINTS.DELIVERY_ACTIVE);
    return response.data;
  }

  // Get drivers currently delivering orders for a specific user
  async getUserDeliveryDrivers(userId) {
    const orders = await this.getUserOrders(userId);

    const activeDeliveryOrders = orders
      .filter(order => order.driver_id && order.delivery_status &&
              !['completed', 'cancelled', 'delivered'].includes(order.delivery_status));

    if (activeDeliveryOrders.length === 0) {
      return [];
    }

    const activeDeliveries = await this.getActiveDeliveries();

    const drivers = activeDeliveryOrders.map(order => {
      const activeDelivery = activeDeliveries.find(delivery =>
        delivery.order_id === order.id && delivery.driver_id === order.driver_id
      );

      return {
        id: order.driver_id,
        name: order.driver_name || activeDelivery?.driver_name || `Driver ${order.driver_id}`,
        license_plate: order.driver_car,
        is_available: false,
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
      const response = await apiClient.get(ENDPOINTS.DELIVERY_DRIVERS_ADMIN, {
        headers: { 'Authorization': `Bearer ${password}` }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching all drivers:', error);
      if (error.response?.status === 401) {
        throw new Error('Invalid admin password');
      }
      throw error;
    }
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

  // Store/Category services
  async searchStores(query, categories = []) {
    const params = { q: query, categories: categories.join(',') };
    const response = await apiClient.get(ENDPOINTS.SEARCH, { params });
    return response.data;
  }

  async getStoresByCategories(categories = []) {
    const params = categories.length > 0 ? { categories: categories.join(',') } : {};
    const response = await apiClient.get(ENDPOINTS.NEARBY_ALL, { params });
    return response.data;
  }

  async getCategories() {
    try {
      const response = await apiClient.get(ENDPOINTS.CATEGORIES);
      return response.data;
    } catch (error) {
      console.error('Error fetching categories:', error);
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

  // Saved locations
  async getSavedLocations(userId) {
    const response = await apiClient.get(ENDPOINTS.USER_SAVED_LOCATIONS(userId));
    return response.data;
  }

  async saveLocation(locationData) {
    const response = await apiClient.post(ENDPOINTS.SAVED_LOCATIONS, locationData);
    return response.data;
  }
}

// Export singleton instance
const apiService = new ApiService();
export default apiService;

// Named exports for components that import specific methods
export const {
  login,
  register,
  createOrder,
  getUserOrders,
  createReservation,
  getUserReservations,
  searchStores,
  getStoresByCategories,
  getCategories,
  getAvailableDrivers,
  getActiveDeliveries,
  getUserDeliveryDrivers,
  getAllDriversAdmin,
  checkDeliveryAvailability,
  getSavedLocations,
  saveLocation
} = apiService;
