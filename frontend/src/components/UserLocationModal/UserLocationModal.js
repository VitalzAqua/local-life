import React, { useState } from 'react';
import AddressInput from '../AddressInput/AddressInput';
import styles from './UserLocationModal.module.css';

const UserLocationModal = ({ isOpen, onClose, onLocationSet, title = "Set Your Location" }) => {
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [isConfirming, setIsConfirming] = useState(false);

  if (!isOpen) return null;

  const handleAddressSelect = (addressData) => {
    setSelectedAddress(addressData);
  };

  const handleConfirm = async () => {
    if (!selectedAddress) return;

    setIsConfirming(true);
    
    try {
      // Call the parent callback with the selected location
      await onLocationSet({
        address: selectedAddress.address,
        lat: selectedAddress.lat,
        lng: selectedAddress.lng,
        components: selectedAddress.components
      });
      
      // Close the modal
      onClose();
    } catch (error) {
      console.error('Error setting location:', error);
      // Handle error if needed
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancel = () => {
    setSelectedAddress(null);
    onClose();
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button 
            className={styles.closeButton}
            onClick={handleCancel}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className={styles.content}>
          <p className={styles.description}>
            Please enter your address to find nearby stores and services. 
            Start typing and select from the suggestions.
          </p>

          <div className={styles.addressInputContainer}>
            <label className={styles.label}>
              Your Address
            </label>
            <AddressInput
              onAddressSelect={handleAddressSelect}
              placeholder="Start typing your address..."
            />
          </div>

          {selectedAddress && (
            <div className={styles.selectedAddress}>
              <h4 className={styles.selectedTitle}>Selected Address:</h4>
              <p className={styles.selectedText}>{selectedAddress.address}</p>
              <div className={styles.coordinates}>
                <small>
                  Coordinates: {selectedAddress.lat.toFixed(6)}, {selectedAddress.lng.toFixed(6)}
                </small>
              </div>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button 
            className={styles.cancelButton}
            onClick={handleCancel}
            disabled={isConfirming}
          >
            Cancel
          </button>
          <button 
            className={styles.confirmButton}
            onClick={handleConfirm}
            disabled={!selectedAddress || isConfirming}
          >
            {isConfirming ? (
              <>
                <span className={styles.spinner}></span>
                Setting Location...
              </>
            ) : (
              'Confirm Location'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserLocationModal; 