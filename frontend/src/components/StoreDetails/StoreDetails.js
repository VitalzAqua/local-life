import React, { useState, useEffect } from 'react';
import apiService from '../../services/apiService';
import { getUserId } from '../../utils/auth';
import styles from './StoreDetails.module.css';

const StoreDetails = ({ store, user }) => {
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
  const [customerLocation, setCustomerLocation] = useState('');
  const [deliveryAvailable, setDeliveryAvailable] = useState(true);
  const [gettingLocation, setGettingLocation] = useState(false);

  // Initialize quantities for products
  useEffect(() => {
    if (store?.attributes?.products) {
      const initialQuantities = {};
      store.attributes.products.forEach(product => {
        initialQuantities[product.name] = 0;
      });
      setQuantities(initialQuantities);
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

  // Get user's current location when delivery is selected
  useEffect(() => {
    if (orderType === 'delivery' && store?.category === 'restaurant' && !customerLocation) {
      getCurrentLocation();
    }
  }, [orderType, store]);

  const getCurrentLocation = () => {
    setGettingLocation(true);
    
    if (!navigator.geolocation) {
      setMessage({ type: 'error', text: 'Geolocation is not supported by this browser' });
      setGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        try {
          // Use Nominatim (OpenStreetMap) reverse geocoding API - it's free and doesn't require API key
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
            {
              headers: {
                'User-Agent': 'LocalLifeApp/1.0'
              }
            }
          );
          
          if (response.ok) {
            const data = await response.json();
            
            if (data && data.address) {
              // Build a readable address from the components
              const address = data.address;
              let formattedAddress = '';
              
              // Add house number and street
              if (address.house_number && address.road) {
                formattedAddress = `${address.house_number} ${address.road}`;
              } else if (address.road) {
                formattedAddress = address.road;
              }
              
              // Add city/town
              if (address.city || address.town || address.village) {
                const locality = address.city || address.town || address.village;
                formattedAddress += formattedAddress ? `, ${locality}` : locality;
              }
              
              // Add state/province
              if (address.state || address.province) {
                const region = address.state || address.province;
                formattedAddress += formattedAddress ? `, ${region}` : region;
              }
              
              // Add postal code
              if (address.postcode) {
                formattedAddress += formattedAddress ? ` ${address.postcode}` : address.postcode;
              }
              
              // Use formatted address or fall back to display_name
              setCustomerLocation(formattedAddress || data.display_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
            } else {
              // Fallback to coordinates if no address data
              setCustomerLocation(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
            }
          } else {
            // Fallback to coordinates if API fails
            setCustomerLocation(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
          }
        } catch (error) {
          console.error('Error getting address:', error);
          // Fallback to coordinates
          setCustomerLocation(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        }
        
        setGettingLocation(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        setMessage({ type: 'error', text: 'Unable to get your location. Please enable location services.' });
        setGettingLocation(false);
        // Switch back to eat-in if location fails
        setOrderType('eat_in');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      }
    );
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
    if (store?.category === 'restaurant' && orderType === 'delivery' && !customerLocation.trim()) {
      setMessage({ type: 'error', text: 'Getting your location for delivery...' });
      getCurrentLocation();
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
        user_id: parseInt(userId),
        store_id: store.id,
        items: cart.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          notes: item.notes || ''
        })),
        total_amount: getCartTotal()
      };

      // Add delivery info for restaurants
      if (store?.category === 'restaurant') {
        orderData.order_type = orderType;
        if (orderType === 'delivery') {
          orderData.customer_location = customerLocation;
        }
      }

      await apiService.createOrder(orderData);
      
      setCart([]);
      setCustomerLocation('');
      setMessage({ type: 'success', text: 'Order placed successfully!' });
    } catch (error) {
      console.error('Error placing order:', error);
      if (error.response?.data?.error?.includes('No drivers available')) {
        setMessage({ type: 'error', text: 'No drivers available for delivery. Please try again later or choose eat-in.' });
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
        user_id: parseInt(userId),
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
    if (!store?.attributes?.open || !store?.attributes?.close) return null;
    
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);
    const openTime = store.attributes.open;
    const closeTime = store.attributes.close;
    
    return currentTime >= openTime && currentTime <= closeTime;
  };

  const renderProducts = () => {
    const products = store?.attributes?.products;
    
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
                  onChange={(e) => setOrderType(e.target.value)}
                  disabled={!deliveryAvailable}
                />
                <span>Delivery {!deliveryAvailable ? '(No drivers available)' : ''}</span>
              </label>
            </div>
            
            {orderType === 'delivery' && (
              <div className={styles.deliveryAddress}>
                <label className={styles.formLabel}>Delivery Location</label>
                {gettingLocation ? (
                  <div className={styles.locationStatus}>
                    <span className={styles.locationSpinner}>📍</span>
                    Getting your current location...
                  </div>
                ) : customerLocation ? (
                  <div className={styles.locationDisplay}>
                    <span className={styles.locationIcon}>📍</span>
                    <span className={styles.locationText}>{customerLocation}</span>
                    <button 
                      type="button"
                      className={styles.refreshLocationButton}
                      onClick={getCurrentLocation}
                      title="Refresh location"
                    >
                      🔄
                    </button>
                  </div>
                ) : (
                  <div className={styles.locationStatus}>
                    <button 
                      type="button"
                      className={styles.getLocationButton}
                      onClick={getCurrentLocation}
                    >
                      📍 Get Current Location
                    </button>
                  </div>
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
          <input
            type="time"
            className={styles.formInput}
            value={reservationData.time}
            onChange={(e) => handleReservationChange('time', e.target.value)}
            required
          />
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