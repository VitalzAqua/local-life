import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { buildApiUrl, ENDPOINTS } from '../../config/api';
import styles from './Map.module.css';
import { createCategoryIcons, CategoryIcons, CategoryColors } from '../../utils/leafletIcons';

// Create icons using React Icons
const icons = createCategoryIcons();

// Map updater component
function MapUpdater({ stores }) {
  const map = useMap();
  
  useEffect(() => {
    if (stores && stores.length > 0) {
      const bounds = L.latLngBounds(stores.map(store => [store.lat, store.lng]));
      map.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 15
      });
    }
  }, [stores, map]);

  return null;
}

const Map = ({ userLocation, onStoreSelect }) => {
  const [stores, setStores] = useState([]);
  const [query, setQuery] = useState('');
  const [availableCategories, setAvailableCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [lastSearchQuery, setLastSearchQuery] = useState('');

  // Fetch available categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await axios.get(buildApiUrl(ENDPOINTS.CATEGORIES));
        setAvailableCategories(response.data);
        setSelectedCategories(response.data);
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };
    fetchCategories();
  }, []);

  // Fetch stores
  const fetchStores = async (searchQuery = lastSearchQuery) => {
    try {
      const categoryParams = selectedCategories.length > 0 ? selectedCategories.join(',') : '';
      
      if (searchQuery.trim()) {
        const endpoint = `/api/search?q=${encodeURIComponent(searchQuery)}&categories=${categoryParams}`;
        const res = await axios.get(buildApiUrl(endpoint));
        setStores(res.data);
        setLastSearchQuery(searchQuery);
      } else {
        if (selectedCategories.length > 0) {
          const endpoint = `/api/nearby/all?categories=${categoryParams}`;
          const res = await axios.get(buildApiUrl(endpoint));
          setStores(res.data);
        } else {
          setStores([]);
        }
        setLastSearchQuery('');
      }
    } catch (error) {
      console.error('Error fetching stores:', error);
      setStores([]);
    }
  };

  useEffect(() => {
    fetchStores();
  }, [selectedCategories]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e) => {
    e.preventDefault();
    fetchStores(query);
  };

  const handleClearSearch = () => {
    setQuery('');
    fetchStores('');
  };

  const handleCategoryChange = (category) => {
    setSelectedCategories(prev => {
      const newCategories = prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category];
      return newCategories;
    });
  };

  const formatProducts = (products) => {
    if (!Array.isArray(products)) return 'N/A';
    return products.map(product => `${product.name} ($${product.price.toFixed(2)})`).join(', ');
  };

  const isSearchActive = lastSearchQuery.trim() !== '';

  return (
    <div className={styles.mapContainer}>
      {/* Search Controls */}
      <div className={styles.searchControls}>
        <form onSubmit={handleSearch} className={styles.searchForm}>
          <input
            type="text"
            placeholder="Search by name, category, or products..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={styles.searchInput}
          />
          <button type="submit" className={styles.searchButton}>
            Search
          </button>
          {isSearchActive && (
            <button type="button" onClick={handleClearSearch} className={styles.clearButton}>
              Clear
            </button>
          )}
        </form>

        <div className={styles.categoryFilters}>
          <span className={styles.categoryLabel}>Categories:</span>
          {availableCategories.map(category => {
            const IconComponent = CategoryIcons[category.toLowerCase()] || CategoryIcons.default;
            const iconColor = CategoryColors[category.toLowerCase()] || CategoryColors.default;
            
            return (
              <label key={category} className={styles.categoryCheckbox}>
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(category)}
                  onChange={() => handleCategoryChange(category)}
                />
                <IconComponent 
                  size={16} 
                  color={iconColor} 
                  style={{ marginRight: '4px' }}
                />
                <span>{category}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Map */}
      <div className={styles.mapContent}>
        <MapContainer 
          center={[userLocation.lat, userLocation.lng]} 
          zoom={13} 
          zoomControl={true}
          className={styles.leafletContainer}
        >
          <MapUpdater stores={stores} />
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          
          {/* User location marker */}
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={icons.userLocation}
          >
            <Popup>
              <strong>You are here</strong>
            </Popup>
          </Marker>

          {/* Store markers */}
          {stores.map((store) => (
            <Marker
              key={store.id}
              position={[store.lat, store.lng]}
              icon={icons[store.category?.toLowerCase()] || icons.default}
              eventHandlers={{
                click: () => onStoreSelect(store)
              }}
            >
              <Popup>
                <div>
                  <strong>{store.name}</strong><br/>
                  Category: {store.category}<br/>
                  Address: {store.attributes?.address || 'N/A'}<br/>
                  Products: {formatProducts(store.attributes?.products)}<br/>
                  {store.attributes?.open && store.attributes?.close && (
                    <>Hours: {store.attributes.open} - {store.attributes.close}</>
                  )}
                  <br/>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onStoreSelect(store);
                    }}
                    style={{ marginTop: '8px' }}
                  >
                    View Details
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
};

export default Map; 