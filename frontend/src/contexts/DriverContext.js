// Driver Context - Centralized state management for driver and delivery system
// Manages drivers, orders, assignments, and real-time updates

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import driverService from '../services/driverService';
import deliveryService from '../services/deliveryService';
import driverMovementService from '../services/driverMovementService';
import assignmentAlgorithm from '../utils/assignmentAlgorithm';

// Initial State
const initialState = {
  // Driver Management
  drivers: [],
  selectedDriver: null,
  driverLocations: new Map(), // Map<driverId, { lat, lng, timestamp }>
  
  // Order Management
  pendingOrders: [],
  activeOrders: [],
  completedOrders: [],
  selectedOrder: null,
  
  // Assignment System
  currentAssignments: [], // Array<{ orderId, driverId, status, estimatedTime }>
  assignmentQueue: [], // Orders waiting for assignment
  
  // System Status
  simulationActive: false,
  realTimeUpdates: false,
  systemStats: {
    totalDrivers: 0,
    availableDrivers: 0,
    busyDrivers: 0,
    pendingOrders: 0,
    completedToday: 0,
    averageDeliveryTime: 0
  },
  
  // UI State
  loading: false,
  error: null,
  notifications: []
};

// Action Types
const ActionTypes = {
  // Driver Actions
  SET_DRIVERS: 'SET_DRIVERS',
  ADD_DRIVER: 'ADD_DRIVER',
  UPDATE_DRIVER: 'UPDATE_DRIVER',
  REMOVE_DRIVER: 'REMOVE_DRIVER',
  UPDATE_DRIVER_LOCATION: 'UPDATE_DRIVER_LOCATION',
  SELECT_DRIVER: 'SELECT_DRIVER',
  
  // Order Actions
  SET_ORDERS: 'SET_ORDERS',
  ADD_ORDER: 'ADD_ORDER',
  UPDATE_ORDER: 'UPDATE_ORDER',
  MOVE_ORDER: 'MOVE_ORDER',
  SELECT_ORDER: 'SELECT_ORDER',
  
  // Assignment Actions
  ADD_ASSIGNMENT: 'ADD_ASSIGNMENT',
  UPDATE_ASSIGNMENT: 'UPDATE_ASSIGNMENT',
  COMPLETE_ASSIGNMENT: 'COMPLETE_ASSIGNMENT',
  CANCEL_ASSIGNMENT: 'CANCEL_ASSIGNMENT',
  
  // System Actions
  SET_SIMULATION_STATUS: 'SET_SIMULATION_STATUS',
  SET_REAL_TIME_STATUS: 'SET_REAL_TIME_STATUS',
  UPDATE_STATS: 'UPDATE_STATS',
  
  // UI Actions
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  ADD_NOTIFICATION: 'ADD_NOTIFICATION',
  REMOVE_NOTIFICATION: 'REMOVE_NOTIFICATION'
};

// Reducer Function
const driverReducer = (state, action) => {
  switch (action.type) {
    case ActionTypes.SET_DRIVERS:
      return {
        ...state,
        drivers: action.payload,
        systemStats: {
          ...state.systemStats,
          totalDrivers: action.payload.length,
          availableDrivers: action.payload.filter(d => d.status === 'available').length,
          busyDrivers: action.payload.filter(d => d.status === 'busy').length
        }
      };

    case ActionTypes.UPDATE_DRIVER:
      return {
        ...state,
        drivers: state.drivers.map(driver =>
          driver.id === action.payload.id ? { ...driver, ...action.payload } : driver
        )
      };

    case ActionTypes.UPDATE_DRIVER_LOCATION:
      const { driverId, location } = action.payload;
      const newLocations = new Map(state.driverLocations);
      newLocations.set(driverId, { ...location, timestamp: new Date() });
      
      return {
        ...state,
        driverLocations: newLocations,
        drivers: state.drivers.map(driver =>
          driver.id === driverId 
            ? { ...driver, location: { ...location, timestamp: new Date() } }
            : driver
        )
      };

    case ActionTypes.SELECT_DRIVER:
      return {
        ...state,
        selectedDriver: action.payload
      };

    case ActionTypes.SET_ORDERS:
      const { pending, active, completed } = action.payload;
      return {
        ...state,
        pendingOrders: pending || [],
        activeOrders: active || [],
        completedOrders: completed || [],
        systemStats: {
          ...state.systemStats,
          pendingOrders: (pending || []).length,
          completedToday: (completed || []).filter(o => 
            new Date(o.completedAt).toDateString() === new Date().toDateString()
          ).length
        }
      };

    case ActionTypes.ADD_ORDER:
      return {
        ...state,
        pendingOrders: [...state.pendingOrders, action.payload],
        assignmentQueue: [...state.assignmentQueue, action.payload.id]
      };

    case ActionTypes.MOVE_ORDER:
      const { orderId, from, to } = action.payload;
      const sourceArray = state[from];
      const targetArray = state[to];
      const orderToMove = sourceArray.find(o => o.id === orderId);
      
      if (!orderToMove) return state;
      
      return {
        ...state,
        [from]: sourceArray.filter(o => o.id !== orderId),
        [to]: [...targetArray, { ...orderToMove, status: to.replace('Orders', '') }]
      };

    case ActionTypes.ADD_ASSIGNMENT:
      return {
        ...state,
        currentAssignments: [...state.currentAssignments, action.payload],
        assignmentQueue: state.assignmentQueue.filter(id => id !== action.payload.orderId)
      };

    case ActionTypes.SET_SIMULATION_STATUS:
      return {
        ...state,
        simulationActive: action.payload
      };

    case ActionTypes.SET_REAL_TIME_STATUS:
      return {
        ...state,
        realTimeUpdates: action.payload
      };

    case ActionTypes.SET_LOADING:
      return {
        ...state,
        loading: action.payload
      };

    case ActionTypes.SET_ERROR:
      return {
        ...state,
        error: action.payload
      };

    case ActionTypes.ADD_NOTIFICATION:
      return {
        ...state,
        notifications: [...state.notifications, action.payload]
      };

    case ActionTypes.REMOVE_NOTIFICATION:
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload)
      };

    default:
      return state;
  }
};

// Create Context
const DriverContext = createContext();

// Provider Component
export const DriverProvider = ({ children }) => {
  const [state, dispatch] = useReducer(driverReducer, initialState);

  // Driver Management Functions
  const loadDrivers = useCallback(async () => {
    try {
      dispatch({ type: ActionTypes.SET_LOADING, payload: true });
      const drivers = await driverService.getAllDrivers();
      dispatch({ type: ActionTypes.SET_DRIVERS, payload: drivers });
    } catch (error) {
      dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
    } finally {
      dispatch({ type: ActionTypes.SET_LOADING, payload: false });
    }
  }, []);

  const updateDriverStatus = useCallback(async (driverId, status) => {
    try {
      await driverService.updateDriverStatus(driverId, status);
      dispatch({
        type: ActionTypes.UPDATE_DRIVER,
        payload: { id: driverId, status }
      });
    } catch (error) {
      dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
    }
  }, []);

  const selectDriver = useCallback((driver) => {
    dispatch({ type: ActionTypes.SELECT_DRIVER, payload: driver });
  }, []);

  // Order Management Functions
  const loadOrders = useCallback(async () => {
    try {
      dispatch({ type: ActionTypes.SET_LOADING, payload: true });
      const pending = await deliveryService.getAllPendingOrders();
      // TODO: Load active and completed orders
      dispatch({
        type: ActionTypes.SET_ORDERS,
        payload: { pending, active: [], completed: [] }
      });
    } catch (error) {
      dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
    } finally {
      dispatch({ type: ActionTypes.SET_LOADING, payload: false });
    }
  }, []);

  const createOrder = useCallback(async (orderData) => {
    try {
      const newOrder = await deliveryService.createDeliveryOrder(orderData);
      dispatch({ type: ActionTypes.ADD_ORDER, payload: newOrder });
      
      // Trigger automatic assignment if enabled
      if (state.realTimeUpdates) {
        await runAssignmentAlgorithm();
      }
      
      return newOrder;
    } catch (error) {
      dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
      throw error;
    }
  }, [state.realTimeUpdates]);

  const updateOrderStatus = useCallback(async (orderId, status, location = null) => {
    try {
      await deliveryService.updateOrderStatus(orderId, status, location);
      
      // Move order between lists based on status
      let from, to;
      if (status === 'assigned') {
        from = 'pendingOrders';
        to = 'activeOrders';
      } else if (status === 'delivered') {
        from = 'activeOrders';
        to = 'completedOrders';
      }
      
      if (from && to) {
        dispatch({
          type: ActionTypes.MOVE_ORDER,
          payload: { orderId, from, to }
        });
      }
    } catch (error) {
      dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
    }
  }, []);

  // Assignment Functions
  const assignOrderToDriver = useCallback(async (orderId, driverId) => {
    try {
      const estimatedTime = await deliveryService.calculateDeliveryTime(
        state.drivers.find(d => d.id === driverId)?.location,
        state.pendingOrders.find(o => o.id === orderId)?.customer.location
      );
      
      await deliveryService.assignOrderToDriver(orderId, driverId, estimatedTime);
      
      const assignment = {
        orderId,
        driverId,
        status: 'assigned',
        estimatedTime,
        assignedAt: new Date()
      };
      
      dispatch({ type: ActionTypes.ADD_ASSIGNMENT, payload: assignment });
      await updateOrderStatus(orderId, 'assigned');
      
      // Update driver route in movement service
      const driverOrders = await deliveryService.getOrdersForDriver(driverId);
      await driverMovementService.updateDriverRoute(driverId, driverOrders);
      
      return assignment;
    } catch (error) {
      dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
      throw error;
    }
  }, [state.drivers, state.pendingOrders, updateOrderStatus]);

  const runAssignmentAlgorithm = useCallback(async () => {
    try {
      const availableDrivers = state.drivers.filter(d => d.status === 'available');
      const unassignedOrders = state.pendingOrders;
      
      if (availableDrivers.length === 0 || unassignedOrders.length === 0) {
        return;
      }
      
      const assignments = await assignmentAlgorithm.findOptimalAssignments(
        unassignedOrders,
        availableDrivers
      );
      
      // Execute assignments
      for (const assignment of assignments) {
        await assignOrderToDriver(assignment.orderId, assignment.driverId);
      }
      
      addNotification({
        type: 'success',
        message: `Assigned ${assignments.length} orders automatically`,
        duration: 5000
      });
      
    } catch (error) {
      dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
    }
  }, [state.drivers, state.pendingOrders, assignOrderToDriver]);

  // Movement and Real-time Functions
  const startSimulation = useCallback(async () => {
    try {
      await driverMovementService.startSimulation();
      dispatch({ type: ActionTypes.SET_SIMULATION_STATUS, payload: true });
      
      // Subscribe to driver location updates
      driverMovementService.onLocationUpdate((driverId, location) => {
        dispatch({
          type: ActionTypes.UPDATE_DRIVER_LOCATION,
          payload: { driverId, location }
        });
      });
      
      addNotification({
        type: 'info',
        message: 'Driver simulation started',
        duration: 3000
      });
      
    } catch (error) {
      dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
    }
  }, []);

  const stopSimulation = useCallback(async () => {
    try {
      await driverMovementService.stopSimulation();
      dispatch({ type: ActionTypes.SET_SIMULATION_STATUS, payload: false });
      
      addNotification({
        type: 'info',
        message: 'Driver simulation stopped',
        duration: 3000
      });
      
    } catch (error) {
      dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
    }
  }, []);

  const toggleRealTimeUpdates = useCallback((enabled) => {
    dispatch({ type: ActionTypes.SET_REAL_TIME_STATUS, payload: enabled });
    
    if (enabled) {
      // TODO: Subscribe to real-time updates (WebSocket)
      // Start automatic assignment checking
    } else {
      // TODO: Unsubscribe from real-time updates
      // Stop automatic assignments
    }
  }, []);

  // Utility Functions
  const addNotification = useCallback((notification) => {
    const id = Date.now().toString();
    dispatch({
      type: ActionTypes.ADD_NOTIFICATION,
      payload: { ...notification, id, timestamp: new Date() }
    });
    
    // Auto-remove notification after duration
    if (notification.duration) {
      setTimeout(() => {
        dispatch({ type: ActionTypes.REMOVE_NOTIFICATION, payload: id });
      }, notification.duration);
    }
  }, []);

  const removeNotification = useCallback((id) => {
    dispatch({ type: ActionTypes.REMOVE_NOTIFICATION, payload: id });
  }, []);

  const getDriverLocation = useCallback((driverId) => {
    return state.driverLocations.get(driverId) || null;
  }, [state.driverLocations]);

  const getDriverOrders = useCallback((driverId) => {
    return state.currentAssignments
      .filter(a => a.driverId === driverId)
      .map(a => state.activeOrders.find(o => o.id === a.orderId))
      .filter(Boolean);
  }, [state.currentAssignments, state.activeOrders]);

  // Initialize data on mount
  useEffect(() => {
    loadDrivers();
    loadOrders();
  }, [loadDrivers, loadOrders]);

  // Context value
  const value = {
    // State
    ...state,
    
    // Driver functions
    loadDrivers,
    updateDriverStatus,
    selectDriver,
    getDriverLocation,
    getDriverOrders,
    
    // Order functions
    loadOrders,
    createOrder,
    updateOrderStatus,
    
    // Assignment functions
    assignOrderToDriver,
    runAssignmentAlgorithm,
    
    // Simulation functions
    startSimulation,
    stopSimulation,
    toggleRealTimeUpdates,
    
    // Utility functions
    addNotification,
    removeNotification
  };

  return (
    <DriverContext.Provider value={value}>
      {children}
    </DriverContext.Provider>
  );
};

// Custom Hook
export const useDriver = () => {
  const context = useContext(DriverContext);
  if (!context) {
    throw new Error('useDriver must be used within a DriverProvider');
  }
  return context;
};

export default DriverContext;

// Context Usage Tips:
/*
1. State Management:
   - Centralize all driver and order state
   - Handle real-time updates efficiently
   - Maintain data consistency across components

2. Performance Optimization:
   - Use useCallback for functions to prevent re-renders
   - Memoize expensive calculations
   - Batch state updates when possible

3. Error Handling:
   - Provide user-friendly error messages
   - Handle network failures gracefully
   - Maintain system stability during errors

4. Real-time Updates:
   - Implement WebSocket connections for live data
   - Debounce frequent updates
   - Handle connection drops and reconnection

5. Integration:
   - Connect with map components for visual updates
   - Sync with backend APIs for persistence
   - Coordinate with notification systems
*/ 