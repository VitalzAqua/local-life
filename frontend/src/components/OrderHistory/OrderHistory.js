import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { buildApiUrl, ENDPOINTS } from '../../config/api';
import styles from './OrderHistory.module.css';

const OrderHistory = ({ user }) => {
  const [activeTab, setActiveTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch orders and reservations
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Try to get userId from multiple sources
        let userId = localStorage.getItem('userId');
        
        // Fallback to user prop if available
        if (!userId && user?.id) {
          userId = user.id.toString();
          localStorage.setItem('userId', userId);
        }
        
        // Fallback to parsing stored user object
        if (!userId) {
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            try {
              const userData = JSON.parse(storedUser);
              if (userData.id) {
                userId = userData.id.toString();
                localStorage.setItem('userId', userId);
              }
            } catch (parseError) {
              console.error('Error parsing stored user:', parseError);
            }
          }
        }
        
        if (!userId) {
          throw new Error('User not authenticated');
        }

        const [ordersResponse, reservationsResponse] = await Promise.all([
          axios.get(buildApiUrl(ENDPOINTS.USER_ORDERS(userId))),
          axios.get(buildApiUrl(ENDPOINTS.USER_RESERVATIONS(userId)))
        ]);

        setOrders(ordersResponse.data || []);
        setReservations(reservationsResponse.data || []);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPrice = (price) => {
    return `$${parseFloat(price).toFixed(2)}`;
  };

  const getStatusClass = (status) => {
    const statusLower = status?.toLowerCase() || '';
    if (styles[statusLower]) {
      return `${styles.orderStatus} ${styles[statusLower]}`;
    }
    return styles.orderStatus;
  };

  const renderOrderCard = (order) => (
    <div key={order.id} className={styles.orderCard}>
      <div className={styles.orderHeader}>
        <h3 className={styles.orderTitle}>Order #{order.id}</h3>
        <div className={styles.orderMeta}>
          <span className={styles.orderDate}>{formatDate(order.order_date)}</span>
          <span className={getStatusClass(order.status)}>{order.status}</span>
        </div>
      </div>

      <div className={styles.orderDetails}>
        <div className={styles.orderInfo}>
          <div className={styles.orderInfoItem}>
            <span className={styles.orderInfoLabel}>Store:</span>
            <span className={styles.orderInfoValue}>{order.store_name}</span>
          </div>
          <div className={styles.orderInfoItem}>
            <span className={styles.orderInfoLabel}>Address:</span>
            <span className={styles.orderInfoValue}>{order.store_address}</span>
          </div>
          {order.store_category === 'restaurant' && order.order_type && (
            <div className={styles.orderInfoItem}>
              <span className={styles.orderInfoLabel}>Order Type:</span>
              <span className={`${styles.orderInfoValue} ${styles.orderType} ${styles[order.order_type]}`}>
                {order.order_type === 'eat_in' ? 'Eat In' : 'Delivery'}
              </span>
            </div>
          )}
          {order.order_type === 'delivery' && order.driver_name && (
            <div className={styles.orderInfoItem}>
              <span className={styles.orderInfoLabel}>Driver:</span>
              <span className={styles.orderInfoValue}>
                {order.driver_name} ({order.driver_car})
              </span>
            </div>
          )}
          {order.order_type === 'delivery' && (
            <div className={styles.orderInfoItem}>
              <span className={styles.orderInfoLabel}>Delivery Location:</span>
              <span className={styles.orderInfoValue}>
                {order.customer_location || 'Location not available'}
              </span>
            </div>
          )}
        </div>
        <div className={styles.orderTotal}>
          Total: {formatPrice(order.total_amount)}
        </div>
      </div>

      {order.items && order.items.length > 0 && (
        <div className={styles.orderItems}>
          <div className={styles.orderItemsTitle}>Items:</div>
          <div className={styles.orderItemsList}>
            {order.items.map((item, index) => (
              <div key={index} className={styles.orderItem}>
                <span className={styles.orderItemName}>
                  {item.quantity}x {item.item_name}
                </span>
                <span className={styles.orderItemPrice}>
                  {formatPrice(item.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderReservationCard = (reservation) => (
    <div key={reservation.id} className={styles.orderCard}>
      <div className={styles.orderHeader}>
        <h3 className={styles.orderTitle}>Reservation #{reservation.id}</h3>
        <div className={styles.orderMeta}>
          <span className={styles.orderDate}>{formatDate(reservation.reservation_date)}</span>
          <span className={getStatusClass(reservation.status)}>{reservation.status}</span>
        </div>
      </div>

      <div className={styles.orderDetails}>
        <div className={styles.orderInfo}>
          <div className={styles.orderInfoItem}>
            <span className={styles.orderInfoLabel}>Store:</span>
            <span className={styles.orderInfoValue}>{reservation.store_name}</span>
          </div>
          {reservation.store_address && (
            <div className={styles.orderInfoItem}>
              <span className={styles.orderInfoLabel}>Address:</span>
              <span className={styles.orderInfoValue}>{reservation.store_address}</span>
            </div>
          )}
          <div className={styles.orderInfoItem}>
            <span className={styles.orderInfoLabel}>Party Size:</span>
            <span className={styles.orderInfoValue}>{reservation.party_size} {reservation.party_size === 1 ? 'person' : 'people'}</span>
          </div>
          <div className={styles.orderInfoItem}>
            <span className={styles.orderInfoLabel}>Time:</span>
            <span className={styles.orderInfoValue}>
              {formatDate(reservation.reservation_date)}
            </span>
          </div>
        </div>
      </div>

      {reservation.notes && (
        <div className={styles.orderItems}>
          <div className={styles.orderItemsTitle}>Notes:</div>
          <div className={styles.orderInfoValue}>{reservation.notes}</div>
        </div>
      )}
    </div>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner}></div>
          <div>Loading your {activeTab}...</div>
        </div>
      );
    }

    if (error) {
      return (
        <div className={styles.errorState}>
          <div className={styles.errorIcon}>⚠️</div>
          <div className={styles.errorTitle}>Error Loading Data</div>
          <div className={styles.errorText}>{error}</div>
        </div>
      );
    }

    const currentData = activeTab === 'orders' ? orders : reservations;

    if (currentData.length === 0) {
      return (
        <div className={styles.emptyState}>
          <div className={styles.emptyStateIcon}>
            {activeTab === 'orders' ? '📋' : '📅'}
          </div>
          <div className={styles.emptyStateTitle}>
            No {activeTab} found
          </div>
          <div className={styles.emptyStateText}>
            {activeTab === 'orders' 
              ? 'You haven\'t placed any orders yet. Start exploring stores to place your first order!'
              : 'You haven\'t made any reservations yet. Find a store and book your first appointment!'
            }
          </div>
        </div>
      );
    }

    return (
      <div className={styles.ordersContainer}>
        {currentData.map(item => 
          activeTab === 'orders' ? renderOrderCard(item) : renderReservationCard(item)
        )}
      </div>
    );
  };

  return (
    <div className={styles.orderHistory}>
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'orders' ? styles.active : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          Orders ({orders.length})
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'reservations' ? styles.active : ''}`}
          onClick={() => setActiveTab('reservations')}
        >
          Reservations ({reservations.length})
        </button>
      </div>

      {renderContent()}
    </div>
  );
};

export default OrderHistory; 