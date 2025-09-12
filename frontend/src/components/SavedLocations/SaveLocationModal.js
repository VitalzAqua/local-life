import React, { useState } from 'react';
import apiService from '../../services/apiService';
import { getUserId } from '../../utils/auth';
import styles from './SaveLocationModal.module.css';

const SaveLocationModal = ({ store, isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    locationName: store?.name || '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.locationName.trim()) {
      setError('Please enter a name for this location');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const userId = getUserId();
      
      if (!userId) {
        setError('Please log in to save locations');
        return;
      }

      const saveData = {
        userId,
        storeId: store.id,
        locationName: formData.locationName.trim(),
        notes: formData.notes.trim() || null
      };

      await apiService.saveLocation(saveData);
      
      if (onSave) {
        onSave();
      }
      
      onClose();
      
      // Reset form for next use
      setFormData({
        locationName: store?.name || '',
        notes: ''
      });
    } catch (error) {
      console.error('Error saving location:', error);
      if (error.response?.status === 409) {
        setError('This location is already saved');
      } else {
        setError('Failed to save location. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (error) {
      setError('');
    }
  };

  const handleClose = () => {
    setFormData({
      locationName: store?.name || '',
      notes: ''
    });
    setError('');
    onClose();
  };

  if (!isOpen || !store) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>💾 Save Location</h2>
          <button 
            className={styles.closeButton}
            onClick={handleClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.storeInfo}>
            <h3>{store.name}</h3>
            <p className={styles.category}>{store.category}</p>
            {store.attributes?.address && (
              <p className={styles.address}>{store.attributes.address}</p>
            )}
          </div>

          {error && (
            <div className={styles.error}>{error}</div>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="locationName" className={styles.label}>
              Custom Name *
            </label>
            <input
              type="text"
              id="locationName"
              name="locationName"
              value={formData.locationName}
              onChange={handleChange}
              className={styles.input}
              placeholder="e.g., My favorite pizza place"
              maxLength={100}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="notes" className={styles.label}>
              Notes (Optional)
            </label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              className={styles.textarea}
              placeholder="e.g., Great for dates, ask for the corner table"
              rows="3"
              maxLength={500}
            />
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              onClick={handleClose}
              className={styles.cancelButton}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.saveButton}
              disabled={loading || !formData.locationName.trim()}
            >
              {loading ? 'Saving...' : '💾 Save Location'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SaveLocationModal; 