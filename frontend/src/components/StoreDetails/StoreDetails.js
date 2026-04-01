import React, { useState, useEffect } from 'react';
import apiService from '../../services/apiService';
import { getUserId } from '../../utils/auth';
import { isStoreOpenNow } from '../../utils/storeHours';
import AddressInput from '../AddressInput/AddressInput';
import styles from './StoreDetails.module.css';

const DEFAULT_RESERVATION_OPEN = '08:00';
const DEFAULT_RESERVATION_CLOSE = '22:00';
const RESERVATION_TIME_STEP_MINUTES = 30;

const normalizeProducts = (products) => {
  if (!Array.isArray(products)) {
    return [];
  }

  return products
    .filter(product => product && typeof product === 'object' && product.name != null && product.price != null)
    .map(product => ({
      name: String(product.name).trim(),
      price: Number(product.price),
      description: typeof product.description === 'string' ? product.description.trim() : ''
    }))
    .filter(product => product.name && Number.isFinite(product.price));
};

const normalizeTimeValue = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  return `${String(match[1]).padStart(2, '0')}:${match[2]}`;
};

const timeToMinutes = (value) => {
  const normalized = normalizeTimeValue(value);
  if (!normalized) {
    return null;
  }

  const [hours, minutes] = normalized.split(':').map(Number);
  return (hours * 60) + minutes;
};

const minutesToTimeValue = (value) => {
  const normalized = ((value % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const formatReservationTimeLabel = (value) => {
  const normalized = normalizeTimeValue(value);
  if (!normalized) {
    return value;
  }

  const [hours, minutes] = normalized.split(':').map(Number);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${suffix}`;
};

const buildReservationTimeOptions = (storeHours = {}) => {
  const open = timeToMinutes(storeHours.open) ?? timeToMinutes(DEFAULT_RESERVATION_OPEN);
  const close = timeToMinutes(storeHours.close) ?? timeToMinutes(DEFAULT_RESERVATION_CLOSE);

  if (open == null || close == null) {
    return [];
  }

  const adjustedClose = close <= open ? close + (24 * 60) : close;
  const options = [];

  for (
    let currentMinutes = open;
    currentMinutes <= adjustedClose;
    currentMinutes += RESERVATION_TIME_STEP_MINUTES
  ) {
    const value = minutesToTimeValue(currentMinutes);
    options.push({
      value,
      label: formatReservationTimeLabel(value)
    });
  }

  return options;
};

const StoreDetails = ({ store, user, currentUserLocation, currentUserAddress }) => {
  const [activeTab, setActiveTab] = useState('products');
  const [cart, setCart] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [reservationData, setReservationData] = useState({
    date: '',
    time: '',
    partySize: 1,
    notes: ''
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);
  const [orderType, setOrderType] = useState('eat_in');
  const [deliveryAddressMode, setDeliveryAddressMode] = useState('current');
  const [customerLocation, setCustomerLocation] = useState('');
  const [customerLocationData, setCustomerLocationData] = useState(null);
  const [deliveryAvailable, setDeliveryAvailable] = useState(true);

  const hasCurrentDeliveryAddress = Boolean(
    currentUserAddress &&
    currentUserLocation?.lat != null &&
    currentUserLocation?.lng != null
  );

  useEffect(() => {
    const products = normalizeProducts(store?.attributes?.products);

    if (products.length > 0) {
      const initialQuantities = {};
      products.forEach(product => {
        initialQuantities[product.name] = 0;
      });
      setQuantities(initialQuantities);
    } else {
      setQuantities({});
    }
  }, [store]);

  // Clear message after 5 seconds
  useEffect(() => {
    if (message.text) {
      const timer = setTimeout(() => {
        setMessage({ type: '', text: '' });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Check delivery availability for restaurants
  useEffect(() => {
    const checkDelivery = async () => {
      if (store?.category === 'restaurant') {
        try {
          const available = await apiService.checkDeliveryAvailability();
          setDeliveryAvailable(available);
        } catch (error) {
          console.error('Error checking delivery availability:', error);
          setDeliveryAvailable(false);
        }
      }
    };
    
    checkDelivery();
  }, [store]);

  useEffect(() => {
    if (orderType !== 'delivery') {
      return;
    }

    if (deliveryAddressMode === 'current') {
      if (!hasCurrentDeliveryAddress) {
        setCustomerLocation('');
        setCustomerLocationData(null);
        return;
      }

      setCustomerLocation(currentUserAddress);
      setCustomerLocationData({
        address: currentUserAddress,
        lat: currentUserLocation.lat,
        lng: currentUserLocation.lng
      });
    }
  }, [
    orderType,
    deliveryAddressMode,
    hasCurrentDeliveryAddress,
    currentUserAddress,
    currentUserLocation
  ]);

  // Handle delivery address selection
  const handleDeliveryAddressSelect = (addressData) => {
    setCustomerLocation(addressData.address);
    setCustomerLocationData({
      address: addressData.address,
      lat: addressData.lat,
      lng: addressData.lng
    });
    setMessage({ type: 'success', text: 'Delivery address set!' });
  };

  const handleDeliveryAddressModeChange = (mode) => {
    setDeliveryAddressMode(mode);

    if (mode === 'custom') {
      setCustomerLocation('');
      setCustomerLocationData(null);
      return;
    }

    if (hasCurrentDeliveryAddress) {
      setCustomerLocation(currentUserAddress);
      setCustomerLocationData({
        address: currentUserAddress,
        lat: currentUserLocation.lat,
        lng: currentUserLocation.lng
      });
    }
  };

  const handleQuantityChange = (productName, delta) => {
    setQuantities(prev => ({
      ...prev,
      [productName]: Math.max(0, (prev[productName] || 0) + delta)
    }));
  };

  const addToCart = (product) => {
    const quantity = quantities[product.name] || 0;
    if (quantity <= 0) return;

    setCart(prev => {
      const existingItem = prev.find(item => item.name === product.name);
      if (existingItem) {
        return prev.map(item =>
          item.name === product.name
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      } else {
        return [...prev, { ...product, quantity }];
      }
    });

    // Reset quantity for this product
    setQuantities(prev => ({
      ...prev,
      [product.name]: 0
    }));

    setMessage({ type: 'success', text: `Added ${quantity}x ${product.name} to cart!` });
  };

  const removeFromCart = (productName) => {
    setCart(prev => prev.filter(item => item.name !== productName));
    setMessage({ type: 'success', text: 'Item removed from cart' });
  };

  const updateCartQuantity = (productName, delta) => {
    setCart(prev => prev.map(item => {
      if (item.name === productName) {
        const newQuantity = Math.max(0, item.quantity + delta);
        return newQuantity > 0 ? { ...item, quantity: newQuantity } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const handlePlaceOrder = async () => {
    if (cart.length === 0) {
      setMessage({ type: 'error', text: 'Your cart is empty' });
      return;
    }

    // For delivery orders, check if customer location is available
    if (store?.category === 'restaurant' && orderType === 'delivery' && (!customerLocation.trim() || !customerLocationData?.lat || !customerLocationData?.lng)) {
      setMessage({ type: 'error', text: 'Please enter your delivery address with valid coordinates.' });
      return;
    }

    setLoading(true);
    try {
      const userId = getUserId(user);
      
      if (!userId) {
        setMessage({ type: 'error', text: 'Please log in to place an order' });
        return;
      }

      const orderData = {
        store_id: parseInt(store.id, 10),
        items: cart.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          notes: item.notes || ''
        })),
        total_amount: Math.round(getCartTotal() * 100) / 100
      };

      // Add delivery info for restaurants
      if (store?.category === 'restaurant') {
        orderData.order_type = orderType;
        if (orderType === 'delivery') {
          orderData.customer_location = customerLocationData || {
            address: customerLocation,
            lat: null,
            lng: null
          };
        }
      }

      await apiService.createOrder(orderData);
      
      
      setCart([]);
      if (deliveryAddressMode === 'custom') {
        setCustomerLocation('');
        setCustomerLocationData(null);
      }
      setMessage({ type: 'success', text: 'Order placed successfully!' });
    } catch (error) {
      console.error('Error placing order:', error);
      const serverMsg = error.response?.data?.error;
      const detail =
        typeof serverMsg === 'string'
          ? serverMsg
          : serverMsg && typeof serverMsg === 'object'
            ? JSON.stringify(serverMsg)
            : null;
      if (detail?.includes('No drivers available')) {
        setMessage({ type: 'error', text: 'No drivers available for delivery. Please try again later or choose eat-in.' });
      } else if (detail) {
        setMessage({ type: 'error', text: detail });
      } else {
        setMessage({ type: 'error', text: 'Failed to place order. Please try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReservationSubmit = async (e) => {
    e.preventDefault();
    
    if (!reservationData.date || !reservationData.time) {
      setMessage({ type: 'error', text: 'Please fill in all required fields' });
      return;
    }

    setLoading(true);
    try {
      const userId = getUserId(user);
      
      if (!userId) {
        setMessage({ type: 'error', text: 'Please log in to make a reservation' });
        return;
      }

      const reservationPayload = {
        store_id: store.id,
        reservation_date: `${reservationData.date}T${reservationData.time}:00`,
        party_size: reservationData.partySize,
        notes: reservationData.notes || ''
      };

      await apiService.createReservation(reservationPayload);
      
      setReservationData({ date: '', time: '', partySize: 1, notes: '' });
      setMessage({ type: 'success', text: 'Reservation booked successfully!' });
    } catch (error) {
      console.error('Error making reservation:', error);
      setMessage({ type: 'error', text: 'Failed to make reservation. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleReservationChange = (field, value) => {
    setReservationData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const isStoreOpen = () => {
    return isStoreOpenNow(store?.attributes);
  };

  const renderProducts = () => {
    const products = normalizeProducts(store?.attributes?.products);
    
    if (!products || products.length === 0) {
      return (
        <div className={styles.emptyState}>
          <div className={styles.emptyStateIcon}>📦</div>
          <div className={styles.emptyStateTitle}>No Products Available</div>
          <div className={styles.emptyStateText}>
            This store doesn't have any products listed at the moment.
          </div>
        </div>
      );
    }

    return (
      <div className={styles.productsGrid}>
        {products.map((product, index) => (
          <div key={index} className={styles.productCard}>
            <h4 className={styles.productName}>{product.name}</h4>
            <div className={styles.productPrice}>${product.price.toFixed(2)}</div>
            {product.description && (
              <div className={styles.productDescription}>{product.description}</div>
            )}
            <div className={styles.productActions}>
              <div className={styles.quantityControls}>
                <button
                  className={styles.quantityButton}
                  onClick={() => handleQuantityChange(product.name, -1)}
                  disabled={!quantities[product.name]}
                >
                  -
                </button>
                <span className={styles.quantityDisplay}>
                  {quantities[product.name] || 0}
                </span>
                <button
                  className={styles.quantityButton}
                  onClick={() => handleQuantityChange(product.name, 1)}
                >
                  +
                </button>
              </div>
              <button
                className={styles.addToCartButton}
                onClick={() => addToCart(product)}
                disabled={!quantities[product.name]}
              >
                Add to Cart
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderCart = () => {
    if (cart.length === 0) {
      return (
        <div className={styles.emptyState}>
          <div className={styles.emptyStateIcon}>🛒</div>
          <div className={styles.emptyStateTitle}>Your Cart is Empty</div>
          <div className={styles.emptyStateText}>
            Add some products from the store to get started!
          </div>
        </div>
      );
    }

    return (
      <div className={styles.cart}>
        {cart.map((item, index) => (
          <div key={index} className={styles.cartItem}>
            <div className={styles.cartItemInfo}>
              <div className={styles.cartItemName}>{item.name}</div>
              <div className={styles.cartItemPrice}>
                ${item.price.toFixed(2)} each
              </div>
            </div>
            <div className={styles.cartItemActions}>
              <div className={styles.quantityControls}>
                <button
                  className={styles.quantityButton}
                  onClick={() => updateCartQuantity(item.name, -1)}
                >
                  -
                </button>
                <span className={styles.quantityDisplay}>
                  {item.quantity}
                </span>
                <button
                  className={styles.quantityButton}
                  onClick={() => updateCartQuantity(item.name, 1)}
                >
                  +
                </button>
              </div>
              <button
                className={styles.removeButton}
                onClick={() => removeFromCart(item.name)}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
        
        {/* Order Type Selection for Restaurants */}
        {store?.category === 'restaurant' && (
          <div className={styles.orderTypeSection}>
            <h4 className={styles.orderTypeTitle}>Order Type</h4>
            <div className={styles.orderTypeOptions}>
              <label className={styles.orderTypeOption}>
                <input
                  type="radio"
                  name="orderType"
                  value="eat_in"
                  checked={orderType === 'eat_in'}
                  onChange={(e) => setOrderType(e.target.value)}
                />
                <span>Eat In</span>
              </label>
              <label className={`${styles.orderTypeOption} ${!deliveryAvailable ? styles.disabled : ''}`}>
                <input
                  type="radio"
                  name="orderType"
                  value="delivery"
                  checked={orderType === 'delivery'}
                  onChange={(e) => {
                    setOrderType(e.target.value);
                    setDeliveryAddressMode(hasCurrentDeliveryAddress ? 'current' : 'custom');
                  }}
                  disabled={!deliveryAvailable}
                />
                <span>Delivery {!deliveryAvailable ? '(No drivers available)' : ''}</span>
              </label>
            </div>
            
            {orderType === 'delivery' && (
              <div className={styles.deliveryAddress}>
                <label className={styles.formLabel}>Delivery Address</label>
                <div className={styles.deliveryAddressOptions}>
                  <label className={styles.deliveryAddressOption}>
                    <input
                      type="radio"
                      name="deliveryAddressMode"
                      value="current"
                      checked={deliveryAddressMode === 'current'}
                      onChange={() => handleDeliveryAddressModeChange('current')}
                      disabled={!hasCurrentDeliveryAddress}
                    />
                    <span>Use my current address</span>
                  </label>
                  <label className={styles.deliveryAddressOption}>
                    <input
                      type="radio"
                      name="deliveryAddressMode"
                      value="custom"
                      checked={deliveryAddressMode === 'custom'}
                      onChange={() => handleDeliveryAddressModeChange('custom')}
                    />
                    <span>Deliver to a different address</span>
                  </label>
                </div>

                {deliveryAddressMode === 'current' && hasCurrentDeliveryAddress ? (
                  <div className={styles.locationDisplay}>
                    <span className={styles.locationIcon}>📍</span>
                    <span className={styles.locationText}>{customerLocation}</span>
                  </div>
                ) : null}

                {deliveryAddressMode === 'current' && !hasCurrentDeliveryAddress ? (
                  <div className={styles.locationStatus}>
                    <span className={styles.locationIcon}>ℹ️</span>
                    <span>Set your app location first, or choose a different delivery address.</span>
                  </div>
                ) : null}

                {deliveryAddressMode === 'custom' ? (
                  customerLocation ? (
                    <div className={styles.locationDisplay}>
                      <span className={styles.locationIcon}>📍</span>
                      <span className={styles.locationText}>{customerLocation}</span>
                      <button 
                        type="button"
                        className={styles.changeAddressButton}
                        onClick={() => {
                          setCustomerLocation('');
                          setCustomerLocationData(null);
                        }}
                        title="Change address"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div className={styles.addressInputWrapper}>
                      <AddressInput
                        onAddressSelect={handleDeliveryAddressSelect}
                        placeholder="Enter a different delivery address..."
                      />
                    </div>
                  )
                ) : (
                  null
                )}
              </div>
            )}
          </div>
        )}
        
        <div className={styles.cartSummary}>
          <div className={styles.cartTotal}>
            <span>Total: ${getCartTotal().toFixed(2)}</span>
          </div>
          <button
            className={styles.orderButton}
            onClick={handlePlaceOrder}
            disabled={loading || cart.length === 0 || (store?.category === 'restaurant' && orderType === 'delivery' && !deliveryAvailable)}
          >
            {loading ? 'Placing Order...' : 'Place Order'}
          </button>
        </div>
      </div>
    );
  };

  const renderReservations = () => {
    const timeOptions = buildReservationTimeOptions(store?.attributes);

    return (
      <form onSubmit={handleReservationSubmit} className={styles.reservationForm}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Date *</label>
          <input
            type="date"
            className={styles.formInput}
            value={reservationData.date}
            onChange={(e) => handleReservationChange('date', e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            required
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Time *</label>
          <select
            className={styles.formSelect}
            value={reservationData.time}
            onChange={(e) => handleReservationChange('time', e.target.value)}
            required
          >
            <option value="" disabled>Select a reservation time</option>
            {timeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Party Size</label>
          <select
            className={styles.formSelect}
            value={reservationData.partySize}
            onChange={(e) => handleReservationChange('partySize', parseInt(e.target.value))}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map(size => (
              <option key={size} value={size}>{size} {size === 1 ? 'person' : 'people'}</option>
            ))}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Notes</label>
          <textarea
            className={styles.formTextarea}
            value={reservationData.notes}
            onChange={(e) => handleReservationChange('notes', e.target.value)}
            placeholder="Any special requests or notes..."
          />
        </div>

        <button
          type="submit"
          className={styles.reserveButton}
          disabled={loading}
        >
          {loading ? 'Booking...' : 'Book Reservation'}
        </button>
      </form>
    );
  };

  if (!store) {
    return (
      <div className={styles.storeDetails}>
        <div className={styles.emptyState}>
          <div className={styles.emptyStateIcon}>🏪</div>
          <div className={styles.emptyStateTitle}>No Store Selected</div>
          <div className={styles.emptyStateText}>
            Select a store from the map to view details.
          </div>
        </div>
      </div>
    );
  }

  const storeStatus = isStoreOpen();

  return (
    <div className={styles.storeDetails}>
      {/* Store Header */}
      <div className={styles.storeHeader}>
        <h2 className={styles.storeName}>{store.name}</h2>
        <div className={styles.storeCategory}>{store.category}</div>
        
        <div className={styles.storeInfo}>
          <div className={styles.storeInfoItem}>
            <span className={styles.storeInfoIcon}>📍</span>
            <span>{store.attributes?.address || 'Address not available'}</span>
          </div>
          
          {store.attributes?.open && store.attributes?.close && (
            <div className={styles.storeInfoItem}>
              <span className={styles.storeInfoIcon}>🕒</span>
              <span className={storeStatus === true ? styles.storeHours : `${styles.storeHours} ${styles.closed}`}>
                {store.attributes.open} - {store.attributes.close}
                {storeStatus !== null && (storeStatus ? ' (Open)' : ' (Closed)')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Message Display */}
      {message.text && (
        <div className={`${styles.message} ${styles[message.type]}`}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'products' ? styles.active : ''}`}
          onClick={() => setActiveTab('products')}
        >
          Products
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'cart' ? styles.active : ''}`}
          onClick={() => setActiveTab('cart')}
        >
          Cart ({cart.length})
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'reservations' ? styles.active : ''}`}
          onClick={() => setActiveTab('reservations')}
        >
          Reservations 
        </button>
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {activeTab === 'products' && renderProducts()}
        {activeTab === 'cart' && renderCart()}
        {activeTab === 'reservations' && renderReservations()}
      </div>
    </div>
  );
};

export default StoreDetails; 
