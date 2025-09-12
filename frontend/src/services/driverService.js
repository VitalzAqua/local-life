// Simplified Driver Service for Real-time Delivery Tracking
class DriverService {
  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
    this.updateCallbacks = new Set();
    this.simulationInterval = null;
  }

  // Get all available drivers
  async getAvailableDrivers() {
    try {
      console.log('🚗 Fetching available drivers...');
      const response = await fetch(`${this.baseURL}/delivery/drivers/available`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch drivers: ${response.status}`);
      }
      
      const drivers = await response.json();
      console.log(`🚗 Found ${drivers.length} available drivers`);
      return drivers;
    } catch (error) {
      console.error('🚗 Error fetching drivers:', error);
      throw error;
    }
  }

  // Get all drivers (admin only)
  async getAllDriversAdmin(password) {
    try {
      console.log('🔐 Fetching all drivers (admin)...');
      const response = await fetch(`${this.baseURL}/delivery/drivers?password=${encodeURIComponent(password)}`, {
        method: 'GET'
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid admin password');
        }
        throw new Error(`Failed to fetch drivers: ${response.status}`);
      }
      
      const drivers = await response.json();
      console.log(`🔐 Admin view: Found ${drivers.length} total drivers`);
      return drivers;
    } catch (error) {
      console.error('🔐 Error fetching all drivers:', error);
      throw error;
    }
  }

  // Track delivery for an order
  async trackDelivery(orderId) {
    try {
      console.log(`📦 Tracking delivery for order ${orderId}...`);
      const response = await fetch(`${this.baseURL}/delivery/deliveries/order/${orderId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return null; // No delivery found for this order
        }
        throw new Error(`Failed to track delivery: ${response.status}`);
      }
      
      const delivery = await response.json();
      console.log(`📦 Delivery tracking for order ${orderId}:`, delivery);
      return delivery;
    } catch (error) {
      console.error('📦 Error tracking delivery:', error);
      throw error;
    }
  }

  // Update driver location (for simulation)
  async updateDriverLocation(driverId, lat, lng) {
    try {
      const response = await fetch(`${this.baseURL}/delivery/drivers/${driverId}/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update driver location: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('📍 Error updating driver location:', error);
      throw error;
    }
  }

  // Update delivery status
  async updateDeliveryStatus(deliveryId, status) {
    try {
      console.log(`📦 Updating delivery ${deliveryId} status to: ${status}`);
      const response = await fetch(`${this.baseURL}/delivery/deliveries/${deliveryId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update delivery status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log(`📦 Delivery status updated:`, result);
      return result;
    } catch (error) {
      console.error('📦 Error updating delivery status:', error);
      throw error;
    }
  }

  // Start real-time driver movement simulation
  startDriverSimulation() {
    if (this.simulationInterval) {
      this.stopDriverSimulation();
    }

    console.log('🎮 Starting driver movement simulation...');
    
    this.simulationInterval = setInterval(async () => {
      try {
        await fetch(`${this.baseURL}/delivery/simulate-movement`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        // Notify all subscribers of updates
        this.updateCallbacks.forEach(callback => {
          try {
            callback();
          } catch (error) {
            console.error('Error in update callback:', error);
          }
        });
      } catch (error) {
        console.error('🎮 Error in movement simulation:', error);
      }
    }, 10000); // Update every 10 seconds for realistic timing

    // Return unsubscribe function
    return () => {
      this.stopDriverSimulation();
    };
  }

  // Stop driver simulation
  stopDriverSimulation() {
    if (this.simulationInterval) {
      console.log('🎮 Stopping driver movement simulation...');
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
  }

  // Subscribe to driver updates
  subscribeToUpdates(callback) {
    this.updateCallbacks.add(callback);
    
    // Start simulation if not already running
    if (!this.simulationInterval) {
      this.startDriverSimulation();
    }
    
    // Return unsubscribe function
    return () => {
      this.updateCallbacks.delete(callback);
      
      // Stop simulation if no more subscribers
      if (this.updateCallbacks.size === 0) {
        this.stopDriverSimulation();
      }
    };
  }

  // Get status emoji for delivery status
  getStatusEmoji(status) {
    const statusEmojis = {
      'pending': '⏳',
      'assigned': '👤',
      'en_route_to_restaurant': '🚗',
      'at_restaurant': '🏪',
      'picked_up': '📦',
      'delivering': '🚚',
      'delivered': '✅',
      'returning': '🔄'
    };
    return statusEmojis[status] || '❓';
  }

  // Get status description
  getStatusDescription(status) {
    const descriptions = {
      'pending': 'Looking for driver...',
      'assigned': 'Driver assigned',
      'en_route_to_restaurant': 'Driver heading to restaurant',
      'at_restaurant': 'Driver at restaurant (waiting)',
      'picked_up': 'Order picked up',
      'delivering': 'Delivering to you',
      'delivered': 'Order delivered!',
      'returning': 'Driver returning to base'
    };
    return descriptions[status] || 'Unknown status';
  }

  // Calculate distance between two points
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Format driver info for display
  formatDriverInfo(driver) {
    return {
      id: driver.id,
      name: driver.name,
      phone: driver.phone,
      vehicle: `${driver.vehicle_type} (${driver.license_plate})`,
      location: {
        lat: parseFloat(driver.current_lat),
        lng: parseFloat(driver.current_lng)
      },
      isAvailable: driver.is_available,
      isOnline: driver.is_online,
      speed: driver.speed_kmh
    };
  }
}

// Export singleton instance
const driverService = new DriverService();
export default driverService; 