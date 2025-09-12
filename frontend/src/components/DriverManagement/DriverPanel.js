// Driver Management Panel - Main UI for managing drivers and assignments
// Displays driver list, real-time status, and assignment controls

import React, { useState, useEffect, useCallback } from 'react';
import { calculateDistance, formatDistance } from '../../utils/mapUtils';
import styles from './DriverPanel.module.css';

const DriverPanel = ({ 
  drivers = [], 
  pendingOrders = [], 
  onAssignOrder, 
  onDriverAction,
  realTimeUpdates = false 
}) => {
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all'); // all, available, busy, offline
  const [sortBy, setSortBy] = useState('status'); // status, distance, orders, name
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [driverDistances, setDriverDistances] = useState(new Map());

  // Calculate distances from drivers to nearest pending order
  const calculateDriverDistances = useCallback(() => {
    if (!pendingOrders.length) return;

    const distances = new Map();
    
    drivers.forEach(driver => {
      let minDistance = Infinity;
      
      pendingOrders.forEach(order => {
        const distance = calculateDistance(
          driver.location.lat, driver.location.lng,
          order.store.location.lat, order.store.location.lng
        );
        minDistance = Math.min(minDistance, distance);
      });
      
      distances.set(driver.id, minDistance === Infinity ? 0 : minDistance);
    });
    
    setDriverDistances(distances);
  }, [drivers, pendingOrders]);

  // Real-time driver updates
  useEffect(() => {
    if (realTimeUpdates) {
      // Subscribe to driver location and status updates
      const updateInterval = setInterval(() => {
        calculateDriverDistances();
      }, 5000); // Update every 5 seconds

      return () => clearInterval(updateInterval);
    }
  }, [realTimeUpdates, calculateDriverDistances]);

  // Calculate distances when dependencies change
  useEffect(() => {
    calculateDriverDistances();
  }, [calculateDriverDistances]);

  // Filter and sort drivers
  const filteredDrivers = drivers
    .filter(driver => filterStatus === 'all' || driver.status === filterStatus)
    .sort((a, b) => {
      switch (sortBy) {
        case 'status':
          const statusOrder = { available: 1, busy: 2, offline: 3 };
          return (statusOrder[a.status] || 4) - (statusOrder[b.status] || 4);
        case 'distance':
          const distanceA = driverDistances.get(a.id) || 0;
          const distanceB = driverDistances.get(b.id) || 0;
          return distanceA - distanceB;
        case 'orders':
          return b.currentOrders.length - a.currentOrders.length;
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

  const handleDriverSelect = (driver) => {
    setSelectedDriver(driver);
    // Trigger map highlight if available
    if (onDriverAction) {
      onDriverAction(driver.id, 'select');
    }
  };

  const handleAssignOrder = (orderId, driverId) => {
    if (onAssignOrder) {
      onAssignOrder(orderId, driverId);
    }
    setShowAssignmentModal(false);
    setSelectedOrder(null);
  };

  const handleDriverAction = (driverId, action) => {
    if (onDriverAction) {
      onDriverAction(driverId, action);
    }
  };

  const openAssignmentModal = (order) => {
    setSelectedOrder(order);
    setShowAssignmentModal(true);
  };

  return (
    <div className={styles.driverPanel}>
      {/* Header with filters and controls */}
      <div className={styles.panelHeader}>
        <div className={styles.headerTitle}>
          <h2>Driver Management</h2>
          <div className={styles.realTimeIndicator}>
            <span 
              className={`${styles.indicator} ${realTimeUpdates ? styles.active : ''}`}
            >
              {realTimeUpdates ? '🟢 Live' : '🔴 Offline'}
            </span>
          </div>
        </div>
        
        <div className={styles.controls}>
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">All Drivers</option>
            <option value="available">Available</option>
            <option value="busy">Busy</option>
            <option value="offline">Offline</option>
          </select>
          
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className={styles.sortSelect}
          >
            <option value="status">Sort by Status</option>
            <option value="distance">Sort by Distance</option>
            <option value="orders">Sort by Orders</option>
            <option value="name">Sort by Name</option>
          </select>
        </div>
      </div>

      {/* Driver List */}
      <div className={styles.driverList}>
        {filteredDrivers.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No drivers found matching the current filters.</p>
          </div>
        ) : (
          filteredDrivers.map(driver => (
            <DriverCard 
              key={driver.id}
              driver={driver}
              isSelected={selectedDriver?.id === driver.id}
              onSelect={() => handleDriverSelect(driver)}
              onAction={(action) => handleDriverAction(driver.id, action)}
              nearestOrderDistance={driverDistances.get(driver.id)}
            />
          ))
        )}
      </div>

      {/* Pending Orders Section */}
      {pendingOrders.length > 0 && (
        <div className={styles.pendingOrdersSection}>
          <h3>Pending Orders ({pendingOrders.length})</h3>
          <div className={styles.ordersList}>
            {pendingOrders.slice(0, 3).map(order => (
              <div key={order.id} className={styles.orderItem}>
                <div className={styles.orderInfo}>
                  <span>#{order.id}</span>
                  <span>{order.customer.name}</span>
                  <span className={`${styles.priority} ${styles[order.priority]}`}>
                    {order.priority}
                  </span>
                </div>
                <button 
                  className={styles.assignBtn}
                  onClick={() => openAssignmentModal(order)}
                >
                  Assign
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected Driver Details */}
      {selectedDriver && (
        <DriverDetails 
          driver={selectedDriver}
          onClose={() => setSelectedDriver(null)}
        />
      )}

      {/* Assignment Modal */}
      {showAssignmentModal && selectedOrder && (
        <AssignmentModal 
          order={selectedOrder}
          availableDrivers={drivers.filter(d => d.status === 'available')}
          onAssign={handleAssignOrder}
          onClose={() => {
            setShowAssignmentModal(false);
            setSelectedOrder(null);
          }}
        />
      )}

      {/* Quick Stats */}
      <div className={styles.quickStats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>
            {drivers.filter(d => d.status === 'available').length}
          </span>
          <span className={styles.statLabel}>Available</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>
            {drivers.filter(d => d.status === 'busy').length}
          </span>
          <span className={styles.statLabel}>Busy</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>
            {drivers.filter(d => d.status === 'offline').length}
          </span>
          <span className={styles.statLabel}>Offline</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{pendingOrders.length}</span>
          <span className={styles.statLabel}>Pending Orders</span>
        </div>
      </div>
    </div>
  );
};

// Individual Driver Card Component
const DriverCard = ({ driver, isSelected, onSelect, onAction, nearestOrderDistance }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'available': return '#28a745';
      case 'busy': return '#ffc107';
      case 'offline': return '#6c757d';
      default: return '#007bff';
    }
  };

  const getCapacityColor = (current, max) => {
    const ratio = current / max;
    if (ratio < 0.5) return '#28a745';
    if (ratio < 0.8) return '#ffc107';
    return '#dc3545';
  };

  return (
    <div 
      className={`${styles.driverCard} ${isSelected ? styles.selected : ''}`}
      onClick={onSelect}
    >
      <div className={styles.driverInfo}>
        <div className={styles.driverName}>
          {driver.name}
          {driver.status === 'available' && (
            <span className={styles.availableBadge}>●</span>
          )}
        </div>
        <div className={styles.driverVehicle}>
          {driver.vehicle.type} - {driver.vehicle.licensePlate}
        </div>
        <div 
          className={styles.driverStatus}
          style={{ color: getStatusColor(driver.status) }}
        >
          {driver.status.charAt(0).toUpperCase() + driver.status.slice(1)}
        </div>
      </div>
      
      <div className={styles.driverMetrics}>
        <div className={styles.metric}>
          <span 
            style={{ 
              color: getCapacityColor(driver.currentOrders.length, driver.maxOrders) 
            }}
          >
            Orders: {driver.currentOrders.length}/{driver.maxOrders}
          </span>
        </div>
        <div className={styles.metric}>
          <span>Speed: {driver.speed} km/h</span>
        </div>
        {nearestOrderDistance !== undefined && (
          <div className={styles.metric}>
            <span>Nearest: {formatDistance(nearestOrderDistance)}</span>
          </div>
        )}
      </div>

      <div className={styles.driverActions}>
        {driver.status === 'available' && (
          <button 
            className={styles.actionBtn}
            onClick={(e) => {
              e.stopPropagation();
              onAction('pause');
            }}
          >
            Pause
          </button>
        )}
        {driver.status === 'busy' && (
          <button 
            className={styles.actionBtn}
            onClick={(e) => {
              e.stopPropagation();
              onAction('view-route');
            }}
          >
            View Route
          </button>
        )}
        {driver.status === 'offline' && (
          <button 
            className={styles.actionBtn}
            onClick={(e) => {
              e.stopPropagation();
              onAction('activate');
            }}
          >
            Activate
          </button>
        )}
      </div>
    </div>
  );
};

// Driver Details Panel Component
const DriverDetails = ({ driver, onClose }) => {
  const [currentLocation, setCurrentLocation] = useState(driver.location);
  const [stats, setStats] = useState({
    totalDeliveries: 0,
    averageTime: 0,
    efficiency: 0
  });

  useEffect(() => {
    // Mock stats calculation
    setStats({
      totalDeliveries: Math.floor(Math.random() * 50) + 10,
      averageTime: Math.floor(Math.random() * 15) + 20,
      efficiency: Math.floor(Math.random() * 20) + 80
    });
  }, [driver]);

  return (
    <div className={styles.driverDetails}>
      <div className={styles.detailsHeader}>
        <h3>{driver.name} Details</h3>
        <button className={styles.closeBtn} onClick={onClose}>×</button>
      </div>
      
      <div className={styles.detailsContent}>
        <div className={styles.section}>
          <h4>Contact Information</h4>
          <p>Phone: {driver.phone}</p>
          <p>Status: <span className={styles[driver.status]}>{driver.status}</span></p>
        </div>

        <div className={styles.section}>
          <h4>Vehicle Information</h4>
          <p>Type: {driver.vehicle.type}</p>
          <p>License Plate: {driver.vehicle.licensePlate}</p>
          <p>Capacity: {driver.vehicle.capacity} orders</p>
        </div>

        <div className={styles.section}>
          <h4>Current Location</h4>
          <p>Latitude: {currentLocation.lat.toFixed(4)}</p>
          <p>Longitude: {currentLocation.lng.toFixed(4)}</p>
          <p>Last Update: {new Date(currentLocation.timestamp).toLocaleTimeString()}</p>
        </div>

        <div className={styles.section}>
          <h4>Performance Stats</h4>
          <div className={styles.statGrid}>
            <div className={styles.statItem}>
              <span className={styles.statNumber}>{stats.totalDeliveries}</span>
              <span className={styles.statLabel}>Total Deliveries</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNumber}>{stats.averageTime}min</span>
              <span className={styles.statLabel}>Avg Delivery Time</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNumber}>{stats.efficiency}%</span>
              <span className={styles.statLabel}>Efficiency</span>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h4>Current Orders ({driver.currentOrders.length})</h4>
          {driver.currentOrders.length === 0 ? (
            <p className={styles.noOrders}>No current orders</p>
          ) : (
            driver.currentOrders.map(order => (
              <div key={order.id} className={styles.orderItem}>
                <div className={styles.orderInfo}>
                  <span>Order #{order.id}</span>
                  <span className={styles.orderStatus}>{order.status}</span>
                </div>
                <div className={styles.orderDetails}>
                  <span>Customer: {order.customer?.name}</span>
                  <span>ETA: {order.estimatedDelivery ? 
                    new Date(order.estimatedDelivery).toLocaleTimeString() : 'N/A'}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className={styles.section}>
          <h4>Working Hours</h4>
          <p>{driver.workingHours.start} - {driver.workingHours.end}</p>
        </div>
      </div>
    </div>
  );
};

// Assignment Modal Component
const AssignmentModal = ({ order, availableDrivers, onAssign, onClose }) => {
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [driverScores, setDriverScores] = useState(new Map());

  useEffect(() => {
    // Calculate distance and score for each driver
    const scores = new Map();
    
    availableDrivers.forEach(driver => {
      const distance = calculateDistance(
        driver.location.lat, driver.location.lng,
        order.store.location.lat, order.store.location.lng
      );
      
      const deliveryDistance = calculateDistance(
        order.store.location.lat, order.store.location.lng,
        order.customer.location.lat, order.customer.location.lng
      );
      
      const totalDistance = distance + deliveryDistance;
      const estimatedTime = Math.ceil((totalDistance / driver.speed) * 60);
      
      scores.set(driver.id, {
        distance: distance,
        totalDistance: totalDistance,
        estimatedTime: estimatedTime,
        score: totalDistance + (driver.currentOrders.length * 2)
      });
    });
    
    setDriverScores(scores);
  }, [availableDrivers, order]);

  const sortedDrivers = [...availableDrivers].sort((a, b) => {
    const scoreA = driverScores.get(a.id)?.score || 0;
    const scoreB = driverScores.get(b.id)?.score || 0;
    return scoreA - scoreB;
  });

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3>Assign Order #{order?.id}</h3>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        
        <div className={styles.modalContent}>
          <div className={styles.orderInfo}>
            <h4>Order Details</h4>
            <p><strong>Customer:</strong> {order?.customer.name}</p>
            <p><strong>Address:</strong> {order?.customer.address}</p>
            <p><strong>Store:</strong> {order?.store.name}</p>
            <p><strong>Priority:</strong> <span className={`${styles.priority} ${styles[order?.priority]}`}>
              {order?.priority}
            </span></p>
            <p><strong>Time Limit:</strong> {order?.timeLimit} minutes</p>
          </div>

          <div className={styles.driverSelection}>
            <h4>Available Drivers ({availableDrivers.length}):</h4>
            <div className={styles.driverList}>
              {sortedDrivers.map(driver => {
                const score = driverScores.get(driver.id);
                return (
                  <label key={driver.id} className={styles.driverOption}>
                    <input 
                      type="radio"
                      name="driver"
                      value={driver.id}
                      checked={selectedDriverId === driver.id}
                      onChange={(e) => setSelectedDriverId(e.target.value)}
                    />
                    <div className={styles.driverOptionInfo}>
                      <div className={styles.driverName}>
                        {driver.name} - {driver.vehicle.type}
                      </div>
                      <div className={styles.driverMetrics}>
                        <span>Distance: {score ? formatDistance(score.distance) : 'N/A'}</span>
                        <span>ETA: {score ? score.estimatedTime : 'N/A'}min</span>
                        <span>Load: {driver.currentOrders.length}/{driver.maxOrders}</span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <div className={styles.modalActions}>
          <button 
            className={styles.assignBtn}
            disabled={!selectedDriverId}
            onClick={() => onAssign(order.id, selectedDriverId)}
          >
            Assign Order
          </button>
          <button className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default DriverPanel;

// Component Usage Tips:
/*
1. Integration with Map:
   - Pass map instance to highlight selected drivers
   - Show driver routes and destinations
   - Update driver markers in real-time

2. Real-time Updates:
   - Subscribe to WebSocket updates for driver positions
   - Update driver status automatically
   - Refresh assignment possibilities when drivers move

3. Performance Optimization:
   - Virtualize driver list for large numbers
   - Debounce real-time updates
   - Cache distance calculations

4. User Experience:
   - Show loading states during assignments
   - Provide feedback for user actions
   - Display estimated delivery times

5. Error Handling:
   - Handle assignment failures gracefully
   - Show network connectivity status
   - Validate assignments before submission
*/ 