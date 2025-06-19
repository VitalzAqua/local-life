import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { buildApiUrl, ENDPOINTS } from '../../config/api';
import styles from './AdminDashboard.module.css';

const AdminDashboard = () => {
  const [orders, setOrders] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('orders');

  useEffect(() => {
    fetchAllOrders();
    fetchAllReservations();
    fetchAllUsers();
  }, []);

  const fetchAllOrders = async () => {
    try {
      const response = await axios.get(buildApiUrl(ENDPOINTS.ADMIN_ORDERS));
      setOrders(response.data);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setError('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllReservations = async () => {
    try {
      const response = await axios.get(buildApiUrl(ENDPOINTS.ADMIN_RESERVATIONS));
      setReservations(response.data);
    } catch (error) {
      console.error('Error fetching reservations:', error);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const response = await axios.get(buildApiUrl(ENDPOINTS.ADMIN_USERS));
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchUserDetails = async (userId) => {
    try {
      const response = await axios.get(buildApiUrl(ENDPOINTS.USER_DETAILS(userId)));
      setUserDetails(response.data);
      setSelectedUser(userId);
    } catch (error) {
      console.error('Error fetching user details:', error);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      await axios.patch(buildApiUrl(ENDPOINTS.ORDER_STATUS(orderId)), {
        status: newStatus
      });
      
      setOrders(orders.map(order => 
        order.id === orderId ? { ...order, status: newStatus } : order
      ));
      
              alert(`Order status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error updating order status:', error);
      alert('Failed to update order status');
    }
  };

  const deleteOrder = async (orderId) => {
    if (!window.confirm('Are you sure you want to delete this order? This action cannot be undone.')) {
      return;
    }
    
    try {
      await axios.delete(buildApiUrl(`/api/orders/${orderId}`));
      
      // Remove the order from the state
      setOrders(orders.filter(order => order.id !== orderId));
      
      alert('Order deleted successfully');
    } catch (error) {
      console.error('Error deleting order:', error);
      alert('Failed to delete order');
    }
  };

  const updateReservationStatus = async (reservationId, newStatus) => {
    try {
      await axios.patch(buildApiUrl(ENDPOINTS.RESERVATION_STATUS(reservationId)), {
        status: newStatus
      });
      
      setReservations(reservations.map(reservation => 
        reservation.id === reservationId ? { ...reservation, status: newStatus } : reservation
      ));
      
      alert(`Reservation status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error updating reservation status:', error);
      alert('Failed to update reservation status');
    }
  };

  const deleteReservation = async (reservationId) => {
    if (!window.confirm('Are you sure you want to delete this reservation? This action cannot be undone.')) {
      return;
    }
    
    try {
      await axios.delete(buildApiUrl(`/api/reservations/${reservationId}`));
      
      // Remove the reservation from the state
      setReservations(reservations.filter(reservation => reservation.id !== reservationId));
      
      alert('Reservation deleted successfully');
    } catch (error) {
      console.error('Error deleting reservation:', error);
      alert('Failed to delete reservation');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  };

  const getStatusOptions = () => ['pending', 'confirmed', 'completed', 'cancelled'];

  const renderOrders = () => {
    if (orders.length === 0) {
      return (
        <div className={styles.emptyState}>
          <div className={styles.emptyStateIcon}>📦</div>
          <div className={styles.emptyStateTitle}>No Orders Found</div>
          <div className={styles.emptyStateText}>
            No orders have been placed yet.
          </div>
        </div>
      );
    }

    return (
      <div className={styles.adminList}>
        {orders.map(order => (
          <div key={order.id} className={styles.adminItem}>
            <div className={styles.adminItemHeader}>
              <div className={styles.adminItemInfo}>
                <strong>Order #{order.id}</strong>
                <span className={styles.adminCustomer}>
                  Customer: {order.customer_name || order.user_email || `User ${order.user_id}`}
                </span>
                <span className={styles.adminStore}>{order.store_name}</span>
                <span className={styles.adminDate}>{formatDate(order.created_at)}</span>
                {order.store_category === 'restaurant' && order.order_type && (
                  <span className={`${styles.orderType} ${styles[order.order_type]}`}>
                    {order.order_type === 'eat_in' ? 'Eat In' : 'Delivery'}
                  </span>
                )}
                {order.order_type === 'delivery' && order.driver_name && (
                  <span className={styles.driverInfo}>
                    Driver: {order.driver_name} ({order.driver_car})
                  </span>
                )}
              </div>
              <div className={styles.statusControl}>
                <select
                  value={order.status}
                  onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                  className={styles.statusSelect}
                >
                  {getStatusOptions().map(status => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => deleteOrder(order.id)}
                  className={styles.deleteButton}
                  title="Delete Order"
                >
                  🗑️
                </button>
              </div>
            </div>
            
            <div className={styles.adminItemDetails}>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Store:</span>
                <span className={styles.detailValue}>{order.store_name}</span>
              </div>
              {order.store_address && (
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Address:</span>
                  <span className={styles.detailValue}>{order.store_address}</span>
                </div>
              )}
              {order.order_type === 'delivery' && order.customer_location && (
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Delivery Location:</span>
                  <span className={styles.detailValue}>{order.customer_location}</span>
                </div>
              )}
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Total:</span>
                <span className={`${styles.detailValue} ${styles.totalAmount}`}>
                  ${order.total_amount}
                </span>
              </div>
            </div>
            
            {order.items && order.items.length > 0 && (
              <div className={styles.adminItems}>
                <strong>Items:</strong>
                <ul>
                  {order.items.map((item, index) => (
                    <li key={index}>
                      <span>{item.quantity}x {item.item_name}</span>
                      <span>${item.price}</span>
                      {item.notes && <span className={styles.itemNotes}> ({item.notes})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderReservations = () => {
    if (reservations.length === 0) {
      return (
        <div className={styles.emptyState}>
          <div className={styles.emptyStateIcon}>📅</div>
          <div className={styles.emptyStateTitle}>No Reservations Found</div>
          <div className={styles.emptyStateText}>
            No reservations have been made yet.
          </div>
        </div>
      );
    }

    return (
      <div className={styles.adminList}>
        {reservations.map(reservation => (
          <div key={reservation.id} className={styles.adminItem}>
            <div className={styles.adminItemHeader}>
              <div className={styles.adminItemInfo}>
                <strong>Reservation #{reservation.id}</strong>
                <span className={styles.adminCustomer}>
                  Customer: {reservation.customer_name || reservation.user_email || `User ${reservation.user_id}`}
                </span>
                <span className={styles.adminStore}>{reservation.store_name}</span>
                <span className={styles.adminDate}>{formatDate(reservation.reservation_date)}</span>
              </div>
              <div className={styles.statusControl}>
                <select
                  value={reservation.status}
                  onChange={(e) => updateReservationStatus(reservation.id, e.target.value)}
                  className={styles.statusSelect}
                >
                  {getStatusOptions().map(status => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => deleteReservation(reservation.id)}
                  className={styles.deleteButton}
                  title="Delete Reservation"
                >
                  🗑️
                </button>
              </div>
            </div>
            
            <div className={styles.adminItemDetails}>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Store:</span>
                <span className={styles.detailValue}>{reservation.store_name}</span>
              </div>
              {reservation.store_address && (
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Address:</span>
                  <span className={styles.detailValue}>{reservation.store_address}</span>
                </div>
              )}
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Party Size:</span>
                <span className={styles.detailValue}>{reservation.party_size} {reservation.party_size === 1 ? 'person' : 'people'}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Date & Time:</span>
                <span className={styles.detailValue}>{formatDate(reservation.reservation_date)}</span>
              </div>
            </div>
            
            {reservation.notes && (
              <div className={styles.adminItems}>
                <strong>Notes:</strong>
                <p>{reservation.notes}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderUsers = () => {
    if (users.length === 0) {
      return (
        <div className={styles.emptyState}>
          <div className={styles.emptyStateIcon}>👥</div>
          <div className={styles.emptyStateTitle}>No Users Found</div>
          <div className={styles.emptyStateText}>
            No users have registered yet.
          </div>
        </div>
      );
    }

    return (
      <div className={styles.adminSection}>
        <div className={styles.adminList}>
          {users.map(user => (
            <div key={user.id} className={styles.adminItem}>
              <div className={styles.adminItemHeader}>
                <div className={styles.adminItemInfo}>
                  <strong>{user.name}</strong>
                  <span className={styles.adminCustomer}>{user.email}</span>
                  <span className={styles.adminDate}>
                    Joined: {formatDate(user.created_at)}
                  </span>
                </div>
                <div className={styles.statusControl}>
                  <button
                    className={`${styles.userButton} ${selectedUser === user.id ? styles.selected : ''}`}
                    onClick={() => fetchUserDetails(user.id)}
                  >
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {userDetails && (
          <div className={styles.userDetails}>
            <h4 className={styles.userDetailsTitle}>
              User Details: {userDetails.user.name}
            </h4>
            <div className={styles.userStats}>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{userDetails.totalOrders}</span>
                <span className={styles.statLabel}>Total Orders</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{userDetails.totalReservations}</span>
                <span className={styles.statLabel}>Total Reservations</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>${userDetails.totalSpent}</span>
                <span className={styles.statLabel}>Total Spent</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className={styles.adminDashboard}>
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner}></div>
          <div>Loading admin dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.adminDashboard}>
      {error && <div className={styles.errorState}>{error}</div>}

      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'orders' ? styles.active : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          📦 Orders ({orders.length})
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'reservations' ? styles.active : ''}`}
          onClick={() => setActiveTab('reservations')}
        >
          📅 Reservations ({reservations.length})
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'users' ? styles.active : ''}`}
          onClick={() => setActiveTab('users')}
        >
          👥 Users ({users.length})
        </button>
      </div>

      <div className={styles.adminContent}>
        {activeTab === 'orders' && (
          <div className={styles.adminSection}>
            <h3 className={styles.sectionTitle}>📦 All Orders</h3>
            {renderOrders()}
          </div>
        )}
        
        {activeTab === 'reservations' && (
          <div className={styles.adminSection}>
            <h3 className={styles.sectionTitle}>📅 All Reservations</h3>
            {renderReservations()}
          </div>
        )}
        
        {activeTab === 'users' && (
          <div className={styles.adminSection}>
            <h3 className={styles.sectionTitle}>👥 All Users</h3>
            {renderUsers()}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard; 