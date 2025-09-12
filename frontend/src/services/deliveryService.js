// Delivery Service - Manages delivery orders, assignment, and tracking
// Handles order lifecycle, status updates, and delivery logistics

import { calculateDistance } from '../utils/mapUtils';

class DeliveryService {
  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
  }

  // Order Management
  async createDeliveryOrder(orderData) {
    try {
      const response = await fetch(`${this.baseURL}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...orderData,
          order_type: 'delivery'
        })
      });
      
      if (!response.ok) throw new Error('Failed to create delivery order');
      const order = await response.json();
      
      // Transform to frontend format
      return {
        id: order.id,
        storeId: orderData.storeId,
        store: {
          name: orderData.storeName || 'Local Store',
          address: orderData.storeAddress || '123 Main St',
          location: orderData.storeLocation || { lat: 43.6532, lng: -79.3832 }
        },
        customer: {
          name: orderData.customerName || 'Customer',
          phone: orderData.customerPhone || '+1-555-0000',
          address: orderData.customerAddress,
          location: orderData.customer_location
        },
        items: orderData.items || [],
        status: 'pending',
        priority: orderData.priority || 'normal',
        timeLimit: orderData.timeLimit || 30,
        createdAt: new Date(order.created_at),
        totalAmount: orderData.total_amount,
        route: {
          pickupLocation: orderData.storeLocation,
          deliveryLocation: orderData.customer_location,
          distance: 0,
          estimatedTime: 0
        }
      };
    } catch (error) {
      console.error('Error creating delivery order:', error);
      throw error;
    }
  }

  async getAllPendingOrders() {
    try {
      // In a real app, this would fetch from backend
      // For now, return mock pending orders
      return [
        {
          id: 'order-1',
          storeId: 'store-1',
          store: {
            name: 'Pizza Palace',
            address: '123 Main St',
            location: { lat: 43.6532, lng: -79.3832 }
          },
          customer: {
            name: 'John Doe',
            phone: '+1-555-1234',
            address: '456 Oak Ave',
            location: { lat: 43.6632, lng: -79.3932 }
          },
          items: [
            { name: 'Large Pizza', quantity: 1, price: 20 }
          ],
          status: 'pending',
          priority: 'normal',
          timeLimit: 30,
          createdAt: new Date(Date.now() - 5 * 60000), // 5 minutes ago
          totalAmount: 20,
          route: {
            pickupLocation: { lat: 43.6532, lng: -79.3832 },
            deliveryLocation: { lat: 43.6632, lng: -79.3932 },
            distance: 1.2,
            estimatedTime: 10
          }
        },
        {
          id: 'order-2',
          storeId: 'store-2',
          store: {
            name: 'Burger Haven',
            address: '789 Elm St',
            location: { lat: 43.6432, lng: -79.3732 }
          },
          customer: {
            name: 'Jane Smith',
            phone: '+1-555-5678',
            address: '321 Pine St',
            location: { lat: 43.6732, lng: -79.4032 }
          },
          items: [
            { name: 'Cheeseburger', quantity: 2, price: 15 },
            { name: 'Fries', quantity: 1, price: 5 }
          ],
          status: 'pending',
          priority: 'high',
          timeLimit: 25,
          createdAt: new Date(Date.now() - 10 * 60000), // 10 minutes ago
          totalAmount: 35,
          route: {
            pickupLocation: { lat: 43.6432, lng: -79.3732 },
            deliveryLocation: { lat: 43.6732, lng: -79.4032 },
            distance: 2.8,
            estimatedTime: 15
          }
        }
      ];
    } catch (error) {
      console.error('Error fetching pending orders:', error);
      throw error;
    }
  }

  async getOrderById(orderId) {
    try {
      const response = await fetch(`${this.baseURL}/delivery/order/${orderId}`);
      if (!response.ok) throw new Error('Order not found');
      return await response.json();
    } catch (error) {
      console.error('Error fetching order:', error);
      throw error;
    }
  }

  async updateOrderStatus(orderId, status, location = null) {
    try {
      const response = await fetch(`${this.baseURL}/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          location
        })
      });
      
      if (!response.ok) throw new Error('Failed to update order status');
      return await response.json();
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  }

  // Assignment and Tracking
  async assignOrderToDriver(orderId, driverId, estimatedDeliveryTime) {
    try {
      const response = await fetch(`${this.baseURL}/delivery/assign-driver`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order_id: orderId,
          driver_id: driverId,
          order_type: 'delivery',
          estimated_delivery_time: estimatedDeliveryTime
        })
      });
      
      if (!response.ok) throw new Error('Failed to assign order to driver');
      const result = await response.json();
      
      // Update order status
      await this.updateOrderStatus(orderId, 'assigned');
      
      return result;
    } catch (error) {
      console.error('Error assigning order to driver:', error);
      throw error;
    }
  }

  async getOrdersForDriver(driverId) {
    try {
      // Fetch orders assigned to this driver
      const allOrders = await this.getAllPendingOrders();
      // In a real app, this would be a backend query
      return allOrders.filter(order => order.driverId === driverId);
    } catch (error) {
      console.error('Error fetching orders for driver:', error);
      throw error;
    }
  }

  async calculateDeliveryTime(fromLocation, toLocation, speed = 50) {
    try {
      if (!fromLocation || !toLocation) {
        throw new Error('Invalid locations provided');
      }
      
      const distance = calculateDistance(
        fromLocation.lat, fromLocation.lng,
        toLocation.lat, toLocation.lng
      );
      
      // Calculate base travel time
      const travelTimeHours = distance / speed;
      const travelTimeMinutes = travelTimeHours * 60;
      
      // Add buffer time for pickup/delivery
      const bufferTime = 5; // 5 minutes for pickup/delivery
      
      // Apply traffic factor based on time of day
      const trafficFactor = this.getTrafficFactor(new Date());
      
      return Math.ceil(travelTimeMinutes * trafficFactor + bufferTime);
    } catch (error) {
      console.error('Error calculating delivery time:', error);
      return 30; // Default estimate
    }
  }

  getTrafficFactor(currentTime) {
    const hour = currentTime.getHours();
    
    // Rush hour traffic patterns
    if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
      return 1.5; // 50% longer during rush hour
    } else if (hour >= 11 && hour <= 14) {
      return 1.2; // 20% longer during lunch
    } else {
      return 1.0; // Normal traffic
    }
  }

  async getOptimizedRoute(driverId, orders) {
    try {
      if (!orders || orders.length === 0) {
        return [];
      }
      
      // Simple route optimization - in production, use a proper TSP solver
      const waypoints = [];
      
      // Add all pickup locations first, then deliveries
      orders.forEach(order => {
        waypoints.push({
          type: 'pickup',
          orderId: order.id,
          location: order.store.location,
          address: order.store.address,
          name: order.store.name,
          priority: order.priority
        });
      });
      
      orders.forEach(order => {
        waypoints.push({
          type: 'delivery',
          orderId: order.id,
          location: order.customer.location,
          address: order.customer.address,
          name: order.customer.name,
          priority: order.priority
        });
      });
      
      // Sort by priority and distance (simplified)
      waypoints.sort((a, b) => {
        const priorityWeight = { urgent: 4, high: 3, normal: 2, low: 1 };
        const aPriority = priorityWeight[a.priority] || 2;
        const bPriority = priorityWeight[b.priority] || 2;
        
        if (aPriority !== bPriority) {
          return bPriority - aPriority; // Higher priority first
        }
        
        // Then sort by type (pickups before deliveries)
        if (a.type !== b.type) {
          return a.type === 'pickup' ? -1 : 1;
        }
        
        return 0;
      });
      
      return waypoints;
    } catch (error) {
      console.error('Error optimizing route:', error);
      throw error;
    }
  }

  // Real-time Tracking
  async trackOrderProgress(orderId) {
    try {
      const response = await fetch(`${this.baseURL}/delivery/order/${orderId}`);
      if (!response.ok) throw new Error('Order not found');
      
      const delivery = await response.json();
      
      return {
        orderId,
        status: delivery.completed_at ? 'delivered' : 'in_progress',
        driverId: delivery.driver_id,
        driverName: delivery.driver_name,
        driverCar: delivery.driver_car,
        estimatedDelivery: delivery.estimated_completion_time,
        actualDelivery: delivery.completed_at,
        currentLocation: delivery.customer_location ? 
          JSON.parse(delivery.customer_location) : null
      };
    } catch (error) {
      console.error('Error tracking order progress:', error);
      throw error;
    }
  }

  async notifyCustomer(orderId, message, eta = null) {
    try {
      // In a real app, this would send push notifications or SMS
      console.log(`Notification for order ${orderId}: ${message}`, { eta });
      
      // Mock notification system
      return {
        success: true,
        message: 'Notification sent successfully',
        orderId,
        sentAt: new Date()
      };
    } catch (error) {
      console.error('Error sending customer notification:', error);
      throw error;
    }
  }

  // Helper methods
  async getAllActiveOrders() {
    try {
      const response = await fetch(`${this.baseURL}/orders/admin/all?status=pending,assigned,in_progress`);
      if (!response.ok) throw new Error('Failed to fetch active orders');
      return response.json() || [];
    } catch (error) {
      console.error('Error fetching active orders:', error);
      return [];
    }
  }

  async getAllCompletedOrders() {
    try {
      const response = await fetch(`${this.baseURL}/orders/admin/all?status=completed,cancelled`);
      if (!response.ok) throw new Error('Failed to fetch completed orders');
      return response.json() || [];
    } catch (error) {
      console.error('Error fetching completed orders:', error);
      return [];
    }
  }

  async cancelOrder(orderId, reason) {
    try {
      await this.updateOrderStatus(orderId, 'cancelled');
      
      // In a real app, handle driver reassignment, refunds, etc.
      console.log(`Order ${orderId} cancelled: ${reason}`);
      
      return { success: true, orderId, reason };
    } catch (error) {
      console.error('Error cancelling order:', error);
      throw error;
    }
  }

  // New Delivery Simulation Methods
  async startDeliverySimulation(orderId) {
    try {
      // Get active deliveries to find the delivery record
      const activeDeliveries = await this.getActiveDeliveries();
      const delivery = activeDeliveries.find(d => d.order_id === orderId);
      
      if (!delivery) {
        console.log(`No delivery found for order ${orderId}, might be eat-in order`);
        return { success: false, orderId };
      }

      if (!delivery.driver_id) {
        console.log(`No driver assigned to order ${orderId}`);
        return { success: false, orderId };
      }
      
      // Import driver services dynamically to avoid circular dependencies
      const [{ default: driverMovementService }, { default: driverService }] = await Promise.all([
        import('./driverMovementService'),
        import('./driverService')
      ]);
      
      // Get all drivers to find the assigned driver
      const allDrivers = await driverService.getAvailableDrivers();
      const assignedDriver = allDrivers.find(d => d.id === delivery.driver_id);
      
      if (!assignedDriver) {
        console.log(`Assigned driver ${delivery.driver_id} not found in active drivers`);
        return { success: false, orderId };
      }

      // Add the driver to movement service if not already added
      driverMovementService.addDriver(assignedDriver);
      
      // Start driver movement simulation
      await driverMovementService.startDeliveryRoute(delivery.driver_id, delivery.id, {
        storeLocation: delivery.store_location,
        customerLocation: delivery.customer_location
      });
      
      console.log(`Started delivery simulation for order ${orderId} with driver ${delivery.driver_id}`);
      return { success: true, orderId, driverId: delivery.driver_id };
    } catch (error) {
      console.error('Error starting delivery simulation:', error);
      throw error;
    }
  }

  async startDelivery(deliveryId, storeLocation) {
    try {
      const response = await fetch(`${this.baseURL}/delivery/start-delivery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          delivery_id: deliveryId,
          store_location: storeLocation
        })
      });
      
      if (!response.ok) throw new Error('Failed to start delivery');
      return await response.json();
    } catch (error) {
      console.error('Error starting delivery:', error);
      throw error;
    }
  }

  async arriveAtStore(deliveryId) {
    try {
      const response = await fetch(`${this.baseURL}/delivery/arrive-at-store`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          delivery_id: deliveryId
        })
      });
      
      if (!response.ok) throw new Error('Failed to update arrival at store');
      return await response.json();
    } catch (error) {
      console.error('Error updating arrival at store:', error);
      throw error;
    }
  }

  async pickupOrder(deliveryId) {
    try {
      const response = await fetch(`${this.baseURL}/delivery/pickup-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          delivery_id: deliveryId
        })
      });
      
      if (!response.ok) throw new Error('Failed to update pickup');
      return await response.json();
    } catch (error) {
      console.error('Error updating pickup:', error);
      throw error;
    }
  }

  async enRouteToCustomer(deliveryId) {
    try {
      const response = await fetch(`${this.baseURL}/delivery/en-route-to-customer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          delivery_id: deliveryId
        })
      });
      
      if (!response.ok) throw new Error('Failed to update en route status');
      return await response.json();
    } catch (error) {
      console.error('Error updating en route status:', error);
      throw error;
    }
  }

  async completeDelivery(deliveryId) {
    try {
      const response = await fetch(`${this.baseURL}/delivery/complete-delivery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          delivery_id: deliveryId
        })
      });
      
      if (!response.ok) throw new Error('Failed to complete delivery');
      return await response.json();
    } catch (error) {
      console.error('Error completing delivery:', error);
      throw error;
    }
  }

  async updateDriverLocation(driverId, lat, lng) {
    try {
      const response = await fetch(`${this.baseURL}/delivery/update-driver-location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          driver_id: driverId,
          lat,
          lng
        })
      });
      
      if (!response.ok) throw new Error('Failed to update driver location');
      return await response.json();
    } catch (error) {
      console.error('Error updating driver location:', error);
      throw error;
    }
  }

  async getActiveDeliveries() {
    try {
      const response = await fetch(`${this.baseURL}/delivery/active`);
      if (!response.ok) throw new Error('Failed to fetch active deliveries');
      return await response.json();
    } catch (error) {
      console.error('Error fetching active deliveries:', error);
      throw error;
    }
  }
}

const deliveryService = new DeliveryService();
export default deliveryService;

// Order Model Interface:
/*
DeliveryOrder {
  id: string,
  storeId: string,
  store: {
    name: string,
    address: string,
    location: { lat: number, lng: number }
  },
  customer: {
    name: string,
    phone: string,
    address: string,
    location: { lat: number, lng: number }
  },
  items: Array<{
    name: string,
    quantity: number,
    price: number
  }>,
  status: 'pending' | 'assigned' | 'pickup' | 'transit' | 'delivered' | 'cancelled',
  priority: 'low' | 'normal' | 'high' | 'urgent',
  timeLimit: number, // minutes from creation
  createdAt: Date,
  assignedAt: Date,
  estimatedDelivery: Date,
  actualDelivery: Date,
  driverId: string,
  route: {
    pickupLocation: { lat: number, lng: number },
    deliveryLocation: { lat: number, lng: number },
    distance: number, // km
    estimatedTime: number // minutes
  },
  payment: {
    method: string,
    amount: number,
    status: 'pending' | 'paid' | 'refunded'
  }
}
*/ 