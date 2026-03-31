import axios from 'axios';
import { BASE_URL, ENDPOINTS } from '../config/api';
import { getAdminToken, getUserToken } from '../utils/auth';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const nextConfig = { ...config };
  const userToken = getUserToken();

  if (userToken && !nextConfig.headers?.Authorization) {
    nextConfig.headers = {
      ...nextConfig.headers,
      Authorization: `Bearer ${userToken}`,
    };
  }

  return nextConfig;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error(`API error: ${error.config?.method?.toUpperCase()} ${error.config?.url}`, error.message);
    return Promise.reject(error);
  }
);

const getAdminAuthConfig = () => {
  const adminToken = getAdminToken();

  if (!adminToken) {
    throw new Error('Admin authentication required');
  }

  return {
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  };
};

class ApiService {
  async login(credentials) {
    const response = await apiClient.post(ENDPOINTS.LOGIN, credentials);
    return response.data;
  }

  async register(userData) {
    const response = await apiClient.post(ENDPOINTS.REGISTER, userData);
    return response.data;
  }

  async adminLogin(code) {
    const response = await apiClient.post(ENDPOINTS.ADMIN_LOGIN, { code });
    return response.data;
  }

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

    return drivers.reduce((acc, driver) => {
      if (!acc.find(d => d.id === driver.id)) {
        acc.push(driver);
      }
      return acc;
    }, []);
  }

  async getAllDriversAdmin() {
    try {
      const response = await apiClient.get(ENDPOINTS.DELIVERY_DRIVERS_ADMIN, getAdminAuthConfig());
      return response.data;
    } catch (error) {
      console.error('Error fetching all drivers:', error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        throw new Error('Admin authentication required');
      }
      throw error;
    }
  }

  async createReservation(reservationData) {
    const response = await apiClient.post(ENDPOINTS.RESERVATIONS, reservationData);
    return response.data;
  }

  async getUserReservations(userId) {
    const response = await apiClient.get(ENDPOINTS.USER_RESERVATIONS(userId));
    return response.data;
  }

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

  async getSavedLocations(userId) {
    const response = await apiClient.get(ENDPOINTS.USER_SAVED_LOCATIONS(userId));
    return response.data;
  }

  async saveLocation(locationData) {
    const response = await apiClient.post(ENDPOINTS.SAVED_LOCATIONS, locationData);
    return response.data;
  }

  async getAdminOrders() {
    const response = await apiClient.get(ENDPOINTS.ADMIN_ORDERS, getAdminAuthConfig());
    return response.data;
  }

  async updateAdminOrderStatus(orderId, status) {
    const response = await apiClient.patch(
      ENDPOINTS.ORDER_STATUS(orderId),
      { status },
      getAdminAuthConfig()
    );
    return response.data;
  }

  async deleteAdminOrder(orderId) {
    const response = await apiClient.delete(`/api/orders/${orderId}`, getAdminAuthConfig());
    return response.data;
  }

  async getAdminReservations() {
    const response = await apiClient.get(ENDPOINTS.ADMIN_RESERVATIONS, getAdminAuthConfig());
    return response.data;
  }

  async updateAdminReservationStatus(reservationId, status) {
    const response = await apiClient.patch(
      ENDPOINTS.RESERVATION_STATUS(reservationId),
      { status },
      getAdminAuthConfig()
    );
    return response.data;
  }

  async deleteAdminReservation(reservationId) {
    const response = await apiClient.delete(`/api/reservations/${reservationId}`, getAdminAuthConfig());
    return response.data;
  }

  async getAdminUsers() {
    const response = await apiClient.get(ENDPOINTS.ADMIN_USERS, getAdminAuthConfig());
    return response.data;
  }

  async getAdminUserDetails(userId) {
    const response = await apiClient.get(ENDPOINTS.USER_DETAILS(userId), getAdminAuthConfig());
    return response.data;
  }
}

const apiService = new ApiService();
export default apiService;

export const {
  login,
  register,
  adminLogin,
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
  saveLocation,
  getAdminOrders,
  updateAdminOrderStatus,
  deleteAdminOrder,
  getAdminReservations,
  updateAdminReservationStatus,
  deleteAdminReservation,
  getAdminUsers,
  getAdminUserDetails
} = apiService;
