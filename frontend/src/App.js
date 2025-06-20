import React, { useEffect, useState } from 'react';
import Layout from './components/Layout/Layout';
import Map from './components/Map/Map';
import Auth from './components/Auth';
import StoreDetails from './components/StoreDetails/StoreDetails';
import OrderHistory from './components/OrderHistory/OrderHistory';
import AdminDashboard from './components/AdminDashboard/AdminDashboard';
import AdminLogin from './components/AdminLogin';
import { 
  validateUserSession, 
  clearUserSession, 
  storeUserSession,
  setAdminAuthenticated 
} from './utils/auth';
import './utils/cleanupAdminAuth'; // Auto-cleanup admin auth on app load
import './App.css';

function App() {
  const [location, setLocation] = useState(null);
  const [user, setUser] = useState(null);
  const [selectedStore, setSelectedStore] = useState(null);
  const [sidebarView, setSidebarView] = useState(null); // 'orders', 'store', 'admin'
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  useEffect(() => {
    // Get user location
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        console.error('Error getting location:', err);
        // Default to Toronto if location access denied
        setLocation({ lat: 43.6532, lng: -79.3832 });
      }
    );

    // Validate and restore user session
    const validUser = validateUserSession();
    if (validUser) {
      setUser(validUser);
    }

    // Admin authentication is never persisted - always requires re-authentication
    setIsAdminAuthenticated(false);
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
    // Reset admin authentication when switching views for security
    setIsAdminAuthenticated(false);
  };

  const handleShowOrders = () => {
    if (user) {
      setSidebarView('orders');
      setSelectedStore(null);
      // Reset admin authentication when switching views for security
      setIsAdminAuthenticated(false);
    }
  };

  const handleShowAdmin = () => {
    // Always show admin login for security - no persistent authentication
    setShowAdminLogin(true);
  };

  const handleAdminLogin = () => {
    // Set admin authenticated for current session only (not persisted)
    setIsAdminAuthenticated(true);
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
    setIsAdminAuthenticated(false);
  };

  // Render sidebar content based on current view
  const renderSidebarContent = () => {
    switch (sidebarView) {
      case 'orders':
        return <OrderHistory user={user} />;
      case 'store':
        return selectedStore ? (
          <StoreDetails 
            store={selectedStore} 
            user={user} 
          />
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
      <div className="App">
        <div className="auth-container">
          <header className="auth-header">
            <h1>Local Life Platform</h1>
          </header>
          <main className="auth-main">
            <Auth onLogin={handleLogin} />
          </main>
        </div>
      </div>
    );
  }

  // If location not available, show loading
  if (!location) {
    return (
      <div className="App">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Getting your location...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <Layout
        user={user}
        onLogout={handleLogout}
        onShowOrders={handleShowOrders}
        onShowAdmin={handleShowAdmin}
        sidebarContent={renderSidebarContent()}
        sidebarTitle={getSidebarTitle()}
        onCloseSidebar={handleCloseSidebar}
      >
        <Map 
          userLocation={location}
          onStoreSelect={handleStoreSelect}
        />
      </Layout>

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
