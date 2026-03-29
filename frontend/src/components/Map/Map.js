import React, { useEffect, useCallback, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useMapControls } from '../../hooks/useMapControls';
import { useStoreData } from '../../hooks/useStoreData';
import { createSimpleIcons } from '../../utils/simpleIcons';
import { calculateDistance } from '../../utils/mapUtils';
import { isAuthenticated } from '../../utils/auth';
import SavedLocations from '../SavedLocations/SavedLocations';
import SaveLocationModal from '../SavedLocations/SaveLocationModal';
import EnhancedSearchInput from '../EnhancedSearchInput/EnhancedSearchInput';
import apiService from '../../services/apiService';
import styles from './Map.module.css';


// Distance calculation is now imported from utils

// Simplified map updater using Leaflet's built-in methods
function MapUpdater({ stores, allStores, userLocation, radius, hasSearchResults, selectedLocation, onStoreSelect, icons }) {
  const map = useMap();
  
  // Center map on user location when radius changes (but not when searching)
  useEffect(() => {
    if (!userLocation || hasSearchResults) return;
    
    // If a radius is selected and we're not showing search results, center on user location
    if (radius && radius !== 'all') {
      map.setView([userLocation.lat, userLocation.lng], 13, {
        animate: true,
        duration: 0.5
      });
    }
  }, [map, userLocation, radius, hasSearchResults]);
  
  // Navigate to selected saved location
  useEffect(() => {
    if (selectedLocation) {
      // Use more precise coordinates with setView for better centering
      const lat = parseFloat(selectedLocation.lat);
      const lng = parseFloat(selectedLocation.lng);
      
      map.setView([lat, lng], 12, {
        animate: true,
        duration: 0.8
      });
      
      // Find and open the marker popup for the selected location immediately
      const showPopup = () => {
        // Parse coordinates first
        const targetLat = parseFloat(selectedLocation.lat);
        const targetLng = parseFloat(selectedLocation.lng);
        
        // First try to find the matching store in current stores
        let matchingStore = allStores.find(store => 
          Math.abs(parseFloat(store.lat) - targetLat) < 0.00001 && 
          Math.abs(parseFloat(store.lng) - targetLng) < 0.00001
        );
        
        // If not found in current stores, use the store data from saved location
        if (!matchingStore && selectedLocation.storeData) {
          matchingStore = selectedLocation.storeData;
        }
        
        if (matchingStore && onStoreSelect) {
          // Trigger store selection (opens store details)
          onStoreSelect(matchingStore);
        }
        
        // Also open the map popup - first try to find existing marker
        let foundMarker = false;
        
        map.eachLayer((layer) => {
          if (layer instanceof L.Marker) {
            const { lat, lng } = layer.getLatLng();
            // Check if this marker matches the selected location (with more precise tolerance)
            if (Math.abs(lat - targetLat) < 0.00001 && 
                Math.abs(lng - targetLng) < 0.00001) {
              layer.openPopup();
              foundMarker = true;
            }
          }
        });
        
        // If no marker found (store filtered out), create a temporary marker with popup
        if (!foundMarker && matchingStore) {
          const tempMarker = L.marker([targetLat, targetLng], {
            icon: icons[matchingStore.category?.toLowerCase()] || icons.default
          }).addTo(map);

          // Use a closure-bound click handler — no global window pollution
          const handleTempMarkerClick = () => {
            onStoreSelect(matchingStore);
            map.removeLayer(tempMarker);
          };

          const popupContent = `
            <div class="store-popup">
              <h3>${matchingStore.name}</h3>
              <p><strong>Category:</strong> ${matchingStore.category}</p>
              <p><strong>Address:</strong> ${matchingStore.attributes?.address || 'N/A'}</p>
            </div>
          `;

          tempMarker.bindPopup(popupContent).openPopup();
          tempMarker.on('click', handleTempMarkerClick);

          setTimeout(() => {
            if (map.hasLayer(tempMarker)) {
              map.removeLayer(tempMarker);
            }
          }, 10000);
        }
      };
      
      // Call showPopup immediately
      showPopup();
    }
  }, [map, selectedLocation, allStores, onStoreSelect, icons]);
  
  // Fit bounds to stores when we have search results or when showing all
  useEffect(() => {
    if (!stores.length || !userLocation || selectedLocation) return;
    
    // If we have stores to show, fit bounds to include them
    if (stores.length > 0) {
      const group = new L.featureGroup(
        stores.map(store => L.marker([store.lat, store.lng]))
      );
      
      // Only add user location to bounds if we have no search results and radius is 'all'
      // This way, when searching or filtering categories, we focus only on stores
      if (!hasSearchResults && radius === 'all') {
        group.addLayer(L.marker([userLocation.lat, userLocation.lng]));
      }
      
      // Use Leaflet's built-in fitBounds with padding
      map.fitBounds(group.getBounds().pad(0.1));
    }
  }, [stores, map, userLocation, radius, hasSearchResults, selectedLocation]);

  return null;
}

// AdminPasswordForm component
const AdminPasswordForm = ({ onSubmit, loading, error }) => {
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password.trim()) {
      onSubmit(password);
      setPassword(''); // Clear password after submission
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.passwordForm}>
      <div className={styles.formGroup}>
        <input
          type="password"
          placeholder="Enter admin password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={styles.passwordInput}
          disabled={loading}
          autoFocus
          required
        />
      </div>
      {error && <div className={styles.errorMessage}>{error}</div>}
      <div className={styles.formActions}>
        <button
          type="submit"
          className={styles.submitButton}
          disabled={loading || !password.trim()}
        >
          {loading ? 'Authenticating...' : 'Activate Admin Mode'}
        </button>
      </div>
    </form>
  );
};

const Map = ({ userLocation, onStoreSelect, user }) => {
  const {
    searchQuery,
    setSearchQuery,
    selectedCategories,
    setSelectedCategories,
    radius,
    setRadius,
    customRadius,
    setCustomRadius
  } = useMapControls();

  const {
    stores,
    categories,
    loading,
    error,
    searchStores,
    clearSearch,
    clearMap
  } = useStoreData();


  // Saved locations state
  const [showSavedLocations, setShowSavedLocations] = useState(false);
  const [saveLocationModal, setSaveLocationModal] = useState({ isOpen: false, store: null });
  const [selectedLocation, setSelectedLocation] = useState(null);
  
  // Driver tracking state
  const [drivers, setDrivers] = useState([]);
  const [driversLoading, setDriversLoading] = useState(false);
  const [driversError, setDriversError] = useState(null);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showAdminPasswordModal, setShowAdminPasswordModal] = useState(false);

  const icons = createSimpleIcons();
  
  // Create car icons for drivers
  const carIcons = {
    available: L.divIcon({
      html: '<div style="background-color: #10b981; color: white; font-size: 16px; display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">🚗</div>',
      className: 'driver-icon',
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -15]
    }),
    busy: L.divIcon({
      html: '<div style="background-color: #ef4444; color: white; font-size: 16px; display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">🚗</div>',
      className: 'driver-icon',
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -15]
    })
  };

  // Filter stores by radius using Leaflet's distance calculation
  const filteredStores = radius === 'all' || !userLocation 
    ? stores 
    : stores.filter(store => {
        const radiusKm = radius === 'custom' ? parseFloat(customRadius) : parseFloat(radius);
        return radiusKm > 0 && calculateDistance(
          [userLocation.lat, userLocation.lng],
          [store.lat, store.lng]
        ) <= radiusKm;
      });

  // Fetch drivers function - stable reference
  const fetchDrivers = useCallback(async () => {
    setDriversLoading(true);
    setDriversError(null);
    
    try {
      let fetchedDrivers = [];
      
      if (isAdminMode) {
        fetchedDrivers = await apiService.getAllDriversAdmin(process.env.REACT_APP_ADMIN_CODE);
      } else if (user?.id) {
        fetchedDrivers = await apiService.getUserDeliveryDrivers(user.id);
      }
      
      setDrivers(fetchedDrivers);
    } catch (err) {
      console.error('Error fetching drivers:', err);
      setDriversError(err.message);
      if (err.message.includes('Invalid admin password')) {
        setIsAdminMode(false);
        setShowAdminPasswordModal(false);
      }
    } finally {
      setDriversLoading(false);
    }
  }, [isAdminMode, user?.id]);

  // Handle admin mode activation with password prompt
  const handleAdminModeToggle = useCallback(() => {
    if (!isAdminMode) {
      setShowAdminPasswordModal(true);
    } else {
      setIsAdminMode(false);
    }
  }, [isAdminMode]);

  // Handle admin password submission
  const handleAdminPasswordSubmit = useCallback(async (password) => {
    try {
      setDriversLoading(true);
      setDriversError(null);
      await apiService.getAllDriversAdmin(password);
      setIsAdminMode(true);
      setShowAdminPasswordModal(false);
    } catch (err) {
      console.error('Admin authentication failed:', err);
      setDriversError(err.message || 'Invalid admin password');
    } finally {
      setDriversLoading(false);
    }
  }, []);

  // Enhanced search handlers
  const handleSearchFromInput = useCallback((query) => {
    setSearchQuery(query);
    searchStores(query, selectedCategories);
  }, [selectedCategories, searchStores, setSearchQuery]);

  const handlePlaceSelect = useCallback((locationData) => {
    
    // Center the map on the selected location
    if (locationData.lat && locationData.lng) {
      // Use the map reference to center on the selected location
      // The map component will handle this through selectedLocation state
      setSelectedLocation({
        lat: locationData.lat,
        lng: locationData.lng,
        name: locationData.address,
        type: 'place'
      });
      
      // Clear the selection after centering to allow future selections
      setTimeout(() => setSelectedLocation(null), 1000);
    }
    
    // Set search query to the location for context
    setSearchQuery(locationData.address);
    
    // Search for nearby stores - you can search by general terms or categories
    // This will show all stores near the selected location
    searchStores('', selectedCategories); // Search all stores with current filters
  }, [selectedCategories, searchStores, setSearchQuery]);

  const handleCategoryChange = useCallback((category) => {
    const newCategories = selectedCategories.includes(category)
      ? selectedCategories.filter(c => c !== category)
      : [...selectedCategories, category];
    setSelectedCategories(newCategories);
    searchStores(searchQuery, newCategories);
  }, [selectedCategories, searchQuery, setSelectedCategories, searchStores]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery(''); // Clear the search input
    clearSearch(); // Clear the map results
  }, [setSearchQuery, clearSearch]);

  const handleClearMap = useCallback(() => {
    setSearchQuery(''); // Clear the search input
    clearMap(); // Remove all store icons from the map
  }, [setSearchQuery, clearMap]);

  // Saved locations handlers
  const handleSaveLocation = useCallback((store) => {
    if (!isAuthenticated()) {
      alert('Please log in to save locations');
      return;
    }
    setSaveLocationModal({ isOpen: true, store });
  }, []);

  const handleLocationSelect = useCallback(async (location) => {
    try {
      // First try to find the store in current stores
      let matchingStore = stores.find(store => store.id === location.store_id);
      
      // If not found, fetch all stores in the category to find the complete data
      if (!matchingStore) {
        const categoryStores = await apiService.getStoresByCategories([location.category]);
        matchingStore = categoryStores.find(store => store.id === location.store_id);
        
        // If still not found, try fetching all stores
        if (!matchingStore) {
          const searchResults = await apiService.searchStores(location.store_name, []);
          matchingStore = searchResults.find(store => store.id === location.store_id);
        }
        
        // If still not found, create basic store object
        if (!matchingStore) {
          matchingStore = {
            id: location.store_id,
            name: location.store_name,
            category: location.category,
            lat: location.lat,
            lng: location.lng,
            attributes: location.attributes || {}
          };
        }
      }
      
      // Set the selected location with complete store data
      setSelectedLocation({ ...location, storeData: matchingStore });
      // Clear the selection after a delay to allow for future selections
      setTimeout(() => setSelectedLocation(null), 100);
    } catch (error) {
      console.error('Error fetching store data for saved location:', error);
      // Fallback to basic store data
      const storeFromLocation = {
        id: location.store_id,
        name: location.store_name || location.name,
        category: location.category,
        lat: location.lat,
        lng: location.lng,
        attributes: location.attributes || {}
      };
      setSelectedLocation({ ...location, storeData: storeFromLocation });
      setTimeout(() => setSelectedLocation(null), 100);
    }
  }, [stores]);

  const currentRadius = radius === 'custom' ? parseFloat(customRadius) : parseFloat(radius);
  const showRadiusCircle = radius !== 'all' && userLocation && currentRadius > 0;
  const hasSearchResults = (searchQuery || '').trim() !== '' || selectedCategories.length > 0;

  // Fetch drivers when admin mode changes or user changes
  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  // Poll driver positions every 3 seconds to reflect server-side movement simulation
  useEffect(() => {
    if (!user?.id && !isAdminMode) return;

    const refreshDrivers = async () => {
      try {
        let updatedDrivers = [];
        if (isAdminMode) {
          updatedDrivers = await apiService.getAllDriversAdmin(process.env.REACT_APP_ADMIN_CODE);
        } else if (user?.id) {
          updatedDrivers = await apiService.getUserDeliveryDrivers(user.id);
        }
        setDrivers(updatedDrivers);
      } catch (err) {
        console.error('Error refreshing driver positions:', err);
      }
    };

    refreshDrivers();
    const refreshInterval = setInterval(refreshDrivers, 3000);

    return () => {
      clearInterval(refreshInterval);
    };
  }, [user?.id, isAdminMode]);

  if (error) {
    return <div className={styles.mapError}>Error loading map: {error}</div>;
  }

  // Check if user location is available after all hooks are called
  if (!userLocation || !userLocation.lat || !userLocation.lng) {
    return (
      <div className={styles.mapContainer}>
        <div className={styles.mapError}>
          <div style={{ textAlign: 'center', padding: '2rem', color: '#6c757d' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📍</div>
            <h3>Location Required</h3>
            <p>Please set your location to view the map and find nearby stores.</p>
          </div>
        </div>
      </div>
    );
  }

      return (
      <div className={styles.mapContainer}>
        {/* Enhanced Search Controls */}
        <div className={styles.mapControls}>
          <div className={styles.searchForm}>
            <EnhancedSearchInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onSearch={handleSearchFromInput}
              onLocationSelect={handlePlaceSelect}
              userLocation={userLocation}
              placeholder="Search stores, places, or addresses..."
              className={styles.enhancedSearch}
            />
            <div className={styles.searchButtons}>
              <button type="button" onClick={handleClearSearch} className="btn btn-outline" title="Clear search and show all stores">Clear</button>
              <button type="button" onClick={handleClearMap} className={`btn btn-outline ${styles.clearMapButton}`} title="Remove all store icons from map">🗺️ Clear Map</button>
              {isAuthenticated() && (
                <button 
                  type="button" 
                  onClick={() => setShowSavedLocations(true)} 
                  className="btn btn-secondary"
                  title="View saved locations"
                >
                  📍 Saved
                </button>
              )}
            </div>
          </div>

                  {/* Combined Filters Row */}
        <div className={styles.filtersRow}>
          {/* Simplified Radius Filter */}
          {userLocation && (
            <div className={styles.radiusFilter}>
              <span className="form-label">Distance:</span>
              {['all', '5', '10', '15', 'custom'].map(option => (
                <label key={option} className={styles.radioOption}>
                  <input
                    type="radio"
                    name="radius"
                    value={option}
                    checked={radius === option}
                    onChange={(e) => setRadius(e.target.value)}
                  />
                  {option === 'all' ? 'Show All' : option === 'custom' ? 'Custom' : `${option} km`}
                </label>
              ))}
              {radius === 'custom' && (
                <input
                  type="number"
                  min="0.1"
                  max="100"
                  step="0.1"
                  placeholder="km"
                  value={customRadius}
                  onChange={(e) => setCustomRadius(e.target.value)}
                  className={`form-control ${styles.customRadius}`}
                />
              )}
            </div>
          )}

          {/* Simplified Category Filter */}
          <div className={styles.categoryFilter}>
            <span className="form-label">Categories:</span>
            {categories.length === 0 ? (
              <span style={{ color: '#666', fontSize: '0.9rem' }}>Loading categories...</span>
            ) : (
              categories.map(category => (
                <label key={category} className={styles.checkboxOption}>
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(category)}
                    onChange={() => handleCategoryChange(category)}
                  />
                  {category}
                </label>
              ))
            )}
          </div>

          {/* Driver Admin Filter */}
          <div className={styles.driverFilter}>
            <button
              onClick={handleAdminModeToggle}
              className={`btn btn-sm ${isAdminMode ? 'btn-danger' : 'btn-outline-secondary'}`}
              title={isAdminMode ? 'Exit admin mode' : 'Admin: View all drivers'}
            >
              {isAdminMode ? '🔐 Admin Mode' : '👤 Admin'}
            </button>
          </div>
        </div>

          {/* Results Info */}
          {showRadiusCircle && (
            <div className={styles.resultsInfo}>
              Showing {filteredStores.length} of {stores.length} stores within {currentRadius} km
            </div>
          )}
          {(user?.id || isAdminMode) && (
            <div className={styles.resultsInfo}>
              {driversLoading ? (
                <span>⏳ Loading drivers...</span>
              ) : driversError ? (
                <span style={{ color: '#ef4444' }}>❌ {driversError}</span>
              ) : (
                <span>
                  🚗 {drivers.length} {isAdminMode ? 'total drivers' : 'delivery drivers'} shown
                  {isAdminMode && drivers.length > 0 && <span style={{ color: '#ef4444', marginLeft: '8px' }}>
                    (Admin: {drivers.filter(d => d.is_available).length} available, {drivers.filter(d => !d.is_available).length} busy)
                  </span>}
                  {!isAdminMode && drivers.length > 0 && <span style={{ color: '#2563eb', marginLeft: '8px' }}>
                    (Delivering your orders)
                  </span>}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Simplified Map */}
        <div className={styles.mapContent}>
          {loading ? (
            <div className={styles.mapLoading}>
              <div className="loading-spinner"></div>
              <p>Loading stores...</p>
            </div>
          ) : (
            <MapContainer
              center={[userLocation.lat, userLocation.lng]}
              zoom={13}
              className={styles.leafletContainer}
            >
            <MapUpdater 
              stores={filteredStores}
              allStores={stores}
              userLocation={userLocation}
              radius={radius}
              hasSearchResults={hasSearchResults}
              selectedLocation={selectedLocation}
              onStoreSelect={onStoreSelect}
              icons={icons}
            />
            
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />
            
            {/* User location marker */}
            <Marker position={[userLocation.lat, userLocation.lng]} icon={icons.user}>
              <Popup>
                <strong>You are here</strong>
              </Popup>
            </Marker>

            {/* Radius circle using Leaflet's built-in Circle */}
            {showRadiusCircle && (
              <Circle
                center={[userLocation.lat, userLocation.lng]}
                radius={currentRadius * 1000}
                pathOptions={{
                  color: '#007bff',
                  fillColor: '#007bff',
                  fillOpacity: 0.1,
                  weight: 2,
                  dashArray: '5, 5'
                }}
              />
            )}

            {/* Store markers */}
            {filteredStores.map((store) => (
              <Marker
                key={store.id}
                position={[store.lat, store.lng]}
                icon={icons[store.category?.toLowerCase()] || icons.default}
                eventHandlers={{ click: () => onStoreSelect(store) }}
              >
                                 <Popup>
                   <div className={styles.storePopup}>
                     <h3>{store.name}</h3>
                     <p><strong>Category:</strong> {store.category}</p>
                     <p><strong>Address:</strong> {store.attributes?.address || 'N/A'}</p>
                     {userLocation && (
                       <p><strong>Distance:</strong> {calculateDistance(
                         [userLocation.lat, userLocation.lng],
                         [store.lat, store.lng]
                       ).toFixed(1)} km</p>
                     )}
                     <div className={styles.popupActions}>
                       <button
                         onClick={() => onStoreSelect(store)}
                         className="btn btn-primary btn-sm"
                       >
                         View Details
                       </button>
                       {isAuthenticated() && (
                         <button
                           onClick={() => handleSaveLocation(store)}
                           className="btn btn-secondary btn-sm"
                           title="Save location"
                         >
                           ❤️ Save
                         </button>
                       )}
                     </div>
                   </div>
                 </Popup>
              </Marker>
            ))}

            {/* Driver markers */}
            {(user?.id || isAdminMode) && drivers
              .filter(driver => driver.current_lat != null && driver.current_lng != null)
              .map((driver) => {
                const lat = parseFloat(driver.current_lat);
                const lng = parseFloat(driver.current_lng);
                
                if (isNaN(lat) || isNaN(lng)) return null;
                
                return (
                  <Marker
                    key={`driver-${driver.id}`}
                    position={[lat, lng]}
                    icon={carIcons[driver.is_available ? 'available' : 'busy']}
                  >
                <Popup>
                  <div>
                    <strong>🚗 {driver.name}</strong><br/>
                    <span>Status: {driver.is_available ? '🟢 Available' : '🔴 Busy'}</span><br/>
                    {driver.license_plate && <span>Car: {driver.license_plate}<br/></span>}
                    {!isAdminMode && driver.delivery_status && (
                      <span>Delivery: {driver.delivery_status}<br/></span>
                    )}
                    {!isAdminMode && driver.order_id && (
                      <span>Order #{driver.order_id}<br/></span>
                    )}
                    {isAdminMode && driver.active_orders > 0 && (
                      <span>Active Orders: {driver.active_orders}<br/></span>
                    )}
                    {!driver.current_lat && !driver.current_lng && (
                      <span style={{ color: '#ef4444' }}>📍 Location unavailable</span>
                    )}
                  </div>
                </Popup>
                  </Marker>
                );
              })}
            
            {/* Show info about drivers without location */}
            {(user?.id || isAdminMode) && drivers.filter(driver => !driver.current_lat || !driver.current_lng).length > 0 && (
              <div className={styles.driverLocationWarning}>
                ⚠️ {drivers.filter(driver => !driver.current_lat || !driver.current_lng).length} delivery driver(s) location unavailable
              </div>
            )}
          </MapContainer>
        )}
      </div>
      
      {/* Saved Locations Modal */}
      <SavedLocations
        isOpen={showSavedLocations}
        onClose={() => setShowSavedLocations(false)}
        onLocationSelect={handleLocationSelect}
      />
      
      {/* Save Location Modal */}
      <SaveLocationModal
        store={saveLocationModal.store}
        isOpen={saveLocationModal.isOpen}
        onClose={() => setSaveLocationModal({ isOpen: false, store: null })}
        onSave={() => {
          // Optionally refresh saved locations or show success message
          console.log('Location saved successfully!');
        }}
      />

        {/* Admin Password Modal */}
        {showAdminPasswordModal && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h3>🔐 Admin Password Required</h3>
                <button 
                  className={styles.closeButton}
                  onClick={() => setShowAdminPasswordModal(false)}
                >×</button>
              </div>
              <div className={styles.modalBody}>
                <p>Please enter the admin password to view all drivers.</p>
                <AdminPasswordForm 
                  onSubmit={handleAdminPasswordSubmit}
                  loading={driversLoading}
                  error={driversError}
                />
              </div>
            </div>
          </div>
        )}

    </div>
  );
};

export default Map; 