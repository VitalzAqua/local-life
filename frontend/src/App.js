import React, { useEffect, useState } from 'react';
import Layout from './components/Layout/Layout';
import Map from './components/Map/Map';
import Auth from './components/Auth';
import StoreDetails from './components/StoreDetails/StoreDetails';
import OrderHistory from './components/OrderHistory/OrderHistory';
import AdminDashboard from './components/AdminDashboard/AdminDashboard';
import AdminLogin from './components/AdminLogin';
import UserLocationModal from './components/UserLocationModal/UserLocationModal';
import { 
  validateUserSession, 
  clearUserSession, 
  storeUserSession,
  setAdminAuthenticated,
  AUTH_STORAGE_KEYS
} from './utils/auth';

function App() {
  const [location, setLocation] = useState(null);
  const [user, setUser] = useState(null);
  const [selectedStore, setSelectedStore] = useState(null);
  const [sidebarView, setSidebarView] = useState(null); // 'orders', 'store', 'admin'
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [userAddress, setUserAddress] = useState('');

  useEffect(() => {
    // Clear any persisted admin auth from previous sessions
    localStorage.removeItem(AUTH_STORAGE_KEYS.ADMIN_AUTH);

    // Check if user has previously set their location
    const savedLocation = localStorage.getItem('userLocation');
    const savedAddress = localStorage.getItem('userAddress');
    
    if (savedLocation && savedAddress) {
      try {
        const locationData = JSON.parse(savedLocation);
        setLocation(locationData);
        setUserAddress(savedAddress);
      } catch (error) {
        console.error('Error parsing saved location:', error);
        // Show location modal if saved data is corrupted
        setShowLocationModal(true);
      }
    } else {
      // Show location modal for first-time users
      setShowLocationModal(true);
    }

    // Validate and restore user session
    const validUser = validateUserSession();
    if (validUser) {
      setUser(validUser);
    }

  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    storeUserSession(userData);
  };

  const handleLogout = () => {
    clearUserSession();
    setUser(null);
    setSidebarView(null);
  };

  const handleStoreSelect = (store) => {
    setSelectedStore(store);
    setSidebarView('store');
  };

  const handleShowOrders = () => {
    if (user) {
      setSidebarView('orders');
      setSelectedStore(null);
    }
  };

  const handleShowAdmin = () => {
    setShowAdminLogin(true);
  };

  const handleAdminLogin = () => {
    setAdminAuthenticated(true);
    setShowAdminLogin(false);
    setSidebarView('admin');
    setSelectedStore(null);
  };

  const handleCloseAdminLogin = () => {
    setShowAdminLogin(false);
  };

  const handleCloseSidebar = () => {
    setSidebarView(null);
    setSelectedStore(null);
    // Reset admin authentication when closing sidebar for security
    setAdminAuthenticated(false);
  };

  const handleLocationSet = (locationData) => {
    const location = { lat: locationData.lat, lng: locationData.lng };
    setLocation(location);
    setUserAddress(locationData.address);
    localStorage.setItem('userLocation', JSON.stringify(location));
    localStorage.setItem('userAddress', locationData.address);
  };

  const handleChangeLocation = () => {
    setShowLocationModal(true);
  };

  const renderSidebarContent = () => {
    switch (sidebarView) {
      case 'orders':
        return <OrderHistory user={user} />;
      case 'store':
        return selectedStore ? (
          <StoreDetails store={selectedStore} user={user} />
        ) : null;
      case 'admin':
        return <AdminDashboard />;
      default:
        return null;
    }
  };

  const getSidebarTitle = () => {
    switch (sidebarView) {
      case 'orders':
        return 'My Orders & Reservations';
      case 'store':
        return selectedStore?.name || 'Store Details';
      case 'admin':
        return 'Admin Dashboard';
      default:
        return '';
    }
  };

  // If user not authenticated, show auth component
  if (!user) {
    return (
      <div className="App" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div className="card" style={{ 
          margin: 'auto', 
          maxWidth: '500px', 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white'
        }}>
          <div className="card-header text-center">
            <h1 className="font-bold">Local Life Platform</h1>
          </div>
          <div className="card-body">
            <Auth onLogin={handleLogin} />
          </div>
        </div>
      </div>
    );
  }

  // If location not available, show loading (but not the modal)
  if (!location && !showLocationModal) {
    return (
      <div className="App" style={{ 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white'
      }}>
        <div className="text-center">
          <div className="loading-spinner" style={{ margin: '0 auto 1rem' }}></div>
          <p className="font-medium">Setting up your location...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App" style={{ height: '100vh' }}>
      <Layout
        user={user}
        userAddress={userAddress}
        onLogout={handleLogout}
        onShowOrders={handleShowOrders}
        onShowAdmin={handleShowAdmin}
        onChangeLocation={handleChangeLocation}
        sidebarContent={renderSidebarContent()}
        sidebarTitle={getSidebarTitle()}
        onCloseSidebar={handleCloseSidebar}
      >
        {location ? (
          <Map 
            userLocation={location}
            onStoreSelect={handleStoreSelect}
            user={user}
          />
        ) : (
          <div style={{ 
            height: '100%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            background: '#f8f9fa',
            color: '#6c757d'
          }}>
            <div className="text-center">
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📍</div>
              <h3>Set Your Location</h3>
              <p>Please set your location to find nearby stores and services.</p>
            </div>
          </div>
        )}
      </Layout>

      {/* User Location Modal */}
      <UserLocationModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onLocationSet={handleLocationSet}
        title={location ? "Change Your Location" : "Set Your Location"}
      />

      {/* Admin Login Modal */}
      {showAdminLogin && (
        <div className="modal-overlay">
          <div className="modal-content">
            <AdminLogin
              onAdminLogin={handleAdminLogin}
              onClose={handleCloseAdminLogin}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;