import React, { useState, useEffect } from 'react';
import apiService from '../../services/apiService';
import { getUserId } from '../../utils/auth';
import styles from './SavedLocations.module.css';

const SavedLocations = ({ onLocationSelect, isOpen, onClose }) => {
  const [savedLocations, setSavedLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchSavedLocations();
    }
  }, [isOpen]);

  const fetchSavedLocations = async () => {
    try {
      setLoading(true);
      setError('');
      const userId = getUserId();
      if (!userId) {
        setError('Please log in to view saved locations');
        return;
      }
      
      const locations = await apiService.getSavedLocations(userId);
      setSavedLocations(locations);
    } catch (error) {
      console.error('Error fetching saved locations:', error);
      setError('Failed to load saved locations');
    } finally {
      setLoading(false);
    }
  };

  const handleLocationClick = (location) => {
    // Pass the complete location data including store_id
    onLocationSelect({
      lat: location.lat,
      lng: location.lng,
      name: location.store_name,
      category: location.category,
      store_id: location.store_id,
      store_name: location.store_name,
      attributes: location.attributes,
      // Include all the data from the saved location
      ...location
    });
    onClose();
  };



  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>📍 Saved Locations</h2>
          <button 
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className={styles.content}>
          {loading && (
            <div className={styles.loading}>Loading saved locations...</div>
          )}

          {error && (
            <div className={styles.error}>{error}</div>
          )}

          {!loading && savedLocations.length === 0 && (
            <div className={styles.empty}>
              <p>No saved locations yet.</p>
              <p>Click the ❤️ button on any store to save it here!</p>
            </div>
          )}

          {!loading && savedLocations.length > 0 && (
            <div className={styles.locationsList}>
              {savedLocations.map((location) => (
                <button
                  key={location.id}
                  className={styles.locationButton}
                  onClick={() => handleLocationClick(location)}
                >
                  <div className={styles.locationContent}>
                    <h3>{location.location_name}</h3>
                    <p className={styles.storeName}>{location.store_name}</p>
                    <p className={styles.category}>{location.category}</p>
                  </div>
                  <div className={styles.locationIcon}>📍</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SavedLocations; 