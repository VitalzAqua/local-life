import React, { useState, useEffect, useRef } from 'react';
import driverService from '../../services/driverService';

const DriverTrackingMap = ({ showDrivers, orders = [] }) => {
  const mapRef = useRef(null);
  const googleMapRef = useRef(null);
  const [drivers, setDrivers] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [driverMarkers, setDriverMarkers] = useState(new Map());
  const [deliveryMarkers, setDeliveryMarkers] = useState(new Map());

  // Initialize Google Map
  useEffect(() => {
    if (!mapRef.current || !window.google) return;

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: 43.6532, lng: -79.3832 }, // Toronto downtown
      zoom: 12,
      mapTypeId: 'roadmap',
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        }
      ]
    });

    googleMapRef.current = map;
  }, []);

  // Fetch drivers based on mode
  const fetchDrivers = async () => {
    if (!showDrivers) return;
    
    setLoading(true);
    setError(null);
    
    try {
      let fetchedDrivers = [];
      
      if (isAdminMode) {
        console.log('🔐 Fetching all drivers (admin mode)...');
        fetchedDrivers = await driverService.getAllDriversAdmin(process.env.REACT_APP_ADMIN_CODE || '780523');
      } else {
        console.log('🚗 Fetching available drivers...');
        fetchedDrivers = await driverService.getAvailableDrivers();
      }
      
      setDrivers(fetchedDrivers);
      console.log(`📍 Loaded ${fetchedDrivers.length} drivers`);
    } catch (err) {
      console.error('❌ Error fetching drivers:', err);
      setError(err.message);
      if (err.message.includes('Invalid admin password')) {
        setIsAdminMode(false);
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch delivery tracking for orders
  const fetchDeliveryTracking = async () => {
    if (!orders.length) return;
    
    try {
      const deliveryPromises = orders.map(order => 
        driverService.trackDelivery(order.id).catch(err => {
          console.log(`No delivery found for order ${order.id}`);
          return null;
        })
      );
      
      const deliveryResults = await Promise.all(deliveryPromises);
      const validDeliveries = deliveryResults.filter(delivery => delivery !== null);
      
      setDeliveries(validDeliveries);
      console.log(`📦 Tracking ${validDeliveries.length} deliveries`);
    } catch (err) {
      console.error('❌ Error fetching delivery tracking:', err);
    }
  };

  // Toggle admin mode
  const toggleAdminMode = () => {
    setIsAdminMode(!isAdminMode);
    console.log(isAdminMode ? '👤 Admin mode deactivated' : '🔐 Admin mode activated');
  };

  // Create car icon for driver markers
  const createCarIcon = (isAvailable = true, rotation = 0) => {
    const color = isAvailable ? '#22c55e' : '#ef4444'; // Green for available, red for busy
    return {
      path: 'M29.395,0H17.636c-3.117,0-5.643,3.467-5.643,6.584v34.804c0,3.116,2.526,5.644,5.643,5.644h11.759c3.116,0,5.644-2.527,5.644-5.644V6.584C35.037,3.467,32.511,0,29.395,0z M34.05,14.188v11.665l-2.729,0.351v-4.806L34.05,14.188z M32.618,10.773c-1.016,3.9-2.219,8.51-2.219,8.51H16.631s-1.203-4.61-2.219-8.51C14.412,10.773,23.293,7.755,32.618,10.773z M15.741,21.398v4.806l-2.73-0.351V14.188L15.741,21.398z M30.53,37.471c-0.435,0.877-1.406,1.482-2.528,1.482s-2.093-0.605-2.527-1.482H30.53z M21.534,37.471c-0.434,0.877-1.405,1.482-2.527,1.482c-1.123,0-2.094-0.605-2.528-1.482H21.534z M28.502,35.427H19.52v-1.704h8.982V35.427z',
      fillColor: color,
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 2,
      scale: 0.6,
      anchor: new window.google.maps.Point(23, 23),
      rotation: rotation
    };
  };

  // Create restaurant icon
  const createRestaurantIcon = () => ({
    path: 'M12 2l3.09 6.26L22 9l-5.91 4.09L18 21l-6-3.27L6 21l1.91-7.91L2 9l6.91-.74L12 2z',
    fillColor: '#f59e0b',
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
    scale: 1.5,
    anchor: new window.google.maps.Point(12, 12)
  });

  // Create customer icon
  const createCustomerIcon = () => ({
    path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
    fillColor: '#3b82f6',
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
    scale: 1.2,
    anchor: new window.google.maps.Point(12, 24)
  });

  // Update driver markers on the map
  useEffect(() => {
    if (!googleMapRef.current || !drivers.length) return;

    // Clear existing driver markers
    driverMarkers.forEach(marker => marker.setMap(null));
    const newDriverMarkers = new Map();

    drivers.forEach(driver => {
      const position = {
        lat: parseFloat(driver.current_lat),
        lng: parseFloat(driver.current_lng)
      };

      const marker = new window.google.maps.Marker({
        position: position,
        map: googleMapRef.current,
        icon: createCarIcon(driver.is_available && driver.is_online),
        title: `${driver.name} - ${driver.license_plate}`,
        zIndex: 1000
      });

      // Create info window for driver
      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 10px; min-width: 200px;">
            <h3 style="margin: 0 0 5px 0; color: #333;">🚗 ${driver.name}</h3>
            <p style="margin: 2px 0; color: #666;"><strong>Phone:</strong> ${driver.phone}</p>
            <p style="margin: 2px 0; color: #666;"><strong>Vehicle:</strong> ${driver.vehicle_type}</p>
            <p style="margin: 2px 0; color: #666;"><strong>License:</strong> ${driver.license_plate}</p>
            <p style="margin: 2px 0; color: #666;"><strong>Speed:</strong> ${driver.speed_kmh} km/h</p>
            <p style="margin: 2px 0;">
              <span style="color: ${driver.is_available ? '#22c55e' : '#ef4444'};">
                ${driver.is_available ? '✅ Available' : '🚫 Busy'}
              </span>
              ${driver.is_online ? ' | 🟢 Online' : ' | 🔴 Offline'}
            </p>
          </div>
        `
      });

      marker.addListener('click', () => {
        infoWindow.open(googleMapRef.current, marker);
      });

      newDriverMarkers.set(driver.id, marker);
    });

    setDriverMarkers(newDriverMarkers);
  }, [drivers]);

  // Update delivery markers on the map
  useEffect(() => {
    if (!googleMapRef.current || !deliveries.length) return;

    // Clear existing delivery markers
    deliveryMarkers.forEach(markers => {
      markers.restaurant?.setMap(null);
      markers.customer?.setMap(null);
      markers.route?.setMap(null);
    });
    const newDeliveryMarkers = new Map();

    deliveries.forEach(delivery => {
      if (!delivery.restaurant_location || !delivery.customer_location) return;

      const restaurant = JSON.parse(delivery.restaurant_location);
      const customer = JSON.parse(delivery.customer_location);

      // Restaurant marker
      const restaurantMarker = new window.google.maps.Marker({
        position: { lat: restaurant.lat, lng: restaurant.lng },
        map: googleMapRef.current,
        icon: createRestaurantIcon(),
        title: 'Restaurant',
        zIndex: 500
      });

      // Customer marker
      const customerMarker = new window.google.maps.Marker({
        position: { lat: customer.lat, lng: customer.lng },
        map: googleMapRef.current,
        icon: createCustomerIcon(),
        title: 'Customer',
        zIndex: 500
      });

      // Route line
      const routeLine = new window.google.maps.Polyline({
        path: [
          { lat: restaurant.lat, lng: restaurant.lng },
          { lat: customer.lat, lng: customer.lng }
        ],
        geodesic: true,
        strokeColor: '#6366f1',
        strokeOpacity: 0.8,
        strokeWeight: 3,
        map: googleMapRef.current
      });

      // Info windows
      const restaurantInfo = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 8px;">
            <h4 style="margin: 0 0 5px 0;">🏪 Restaurant Pickup</h4>
            <p style="margin: 2px 0;">Order #${delivery.order_id}</p>
            <p style="margin: 2px 0;">Status: ${driverService.getStatusEmoji(delivery.status)} ${driverService.getStatusDescription(delivery.status)}</p>
          </div>
        `
      });

      const customerInfo = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 8px;">
            <h4 style="margin: 0 0 5px 0;">🏠 Customer Delivery</h4>
            <p style="margin: 2px 0;">Order #${delivery.order_id}</p>
            <p style="margin: 2px 0;">Driver: ${delivery.driver_name || 'Unassigned'}</p>
            <p style="margin: 2px 0;">Status: ${driverService.getStatusEmoji(delivery.status)} ${driverService.getStatusDescription(delivery.status)}</p>
          </div>
        `
      });

      restaurantMarker.addListener('click', () => {
        restaurantInfo.open(googleMapRef.current, restaurantMarker);
      });

      customerMarker.addListener('click', () => {
        customerInfo.open(googleMapRef.current, customerMarker);
      });

      newDeliveryMarkers.set(delivery.id, {
        restaurant: restaurantMarker,
        customer: customerMarker,
        route: routeLine
      });
    });

    setDeliveryMarkers(newDeliveryMarkers);
  }, [deliveries]);

  // Fetch data when showDrivers changes or in admin mode
  useEffect(() => {
    fetchDrivers();
  }, [showDrivers, isAdminMode]);

  // Fetch delivery tracking when orders change
  useEffect(() => {
    fetchDeliveryTracking();
  }, [orders]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!showDrivers) return;

    const unsubscribe = driverService.subscribeToUpdates(() => {
      fetchDrivers();
      fetchDeliveryTracking();
    });

    return unsubscribe;
  }, [showDrivers, isAdminMode]);

  if (!showDrivers) {
    return <div ref={mapRef} style={{ width: '100%', height: '400px' }} />;
  }

  return (
    <div style={{ position: 'relative' }}>
      <div ref={mapRef} style={{ width: '100%', height: '400px' }} />
      
      {/* Admin Mode Toggle */}
      <button
        onClick={toggleAdminMode}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          padding: '8px 12px',
          backgroundColor: isAdminMode ? '#dc2626' : '#374151',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '12px',
          zIndex: 1000
        }}
      >
        {isAdminMode ? '🔐 Admin Mode' : '👤 Admin'}
      </button>



      {/* Status Panel */}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        left: '10px',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        padding: '10px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        fontSize: '12px',
        maxWidth: '250px'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
          {isAdminMode ? '🔐 Admin View' : '🚗 Driver Tracking'}
        </div>
        {loading && <div>⏳ Loading drivers...</div>}
        {error && <div style={{ color: '#dc2626' }}>❌ {error}</div>}
        {!loading && !error && (
          <>
            <div>📍 {drivers.length} drivers shown</div>
            <div>📦 {deliveries.length} active deliveries</div>
            {isAdminMode && <div style={{ color: '#dc2626', fontSize: '10px', marginTop: '5px' }}>
              ⚠️ Showing all drivers (available & busy)
            </div>}
          </>
        )}
        <div style={{ marginTop: '8px', fontSize: '10px', color: '#666' }}>
          🟢 Available | 🔴 Busy<br/>
          🏪 Restaurant | 🏠 Customer
        </div>
      </div>
    </div>
  );
};

export default DriverTrackingMap; 