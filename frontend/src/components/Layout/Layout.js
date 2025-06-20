import React from 'react';
import styles from './Layout.module.css';

const Layout = ({ 
  user, 
  onLogout, 
  onShowOrders, 
  onShowAdmin,
  sidebarContent,
  sidebarTitle,
  onCloseSidebar,
  children 
}) => {
  return (
    <div className={styles.appContainer}>
      {/* Header */}
      <header className={styles.header}>
        <h1 className={styles.headerTitle}>Local Life Platform</h1>
        <div className={styles.userSection}>
          {user ? (
            <div className={styles.userInfo}>
              <span>Welcome, {user.name}!</span>
              <button 
                className={`${styles.actionButton} ${styles.orders}`}
                onClick={onShowOrders}
                title="View your orders and reservations"
              >
                📋 My Orders
              </button>
              <button 
                className={`${styles.actionButton} ${styles.admin}`}
                onClick={onShowAdmin}
                title="Manage orders and reservations"
              >
                🛠️ Admin
              </button>
              <button 
                className={`${styles.actionButton} ${styles.logout}`}
                onClick={onLogout}
              >
                Logout
              </button>
            </div>
          ) : (
            <div>Please log in to continue</div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className={styles.mainContent}>
        {/* Map Section */}
        <div className={styles.mapSection}>
          {children}
        </div>

        {/* Sidebar (Orders/Store Details) */}
        {sidebarContent && (
          <aside className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
              <h2 className={styles.sidebarTitle}>{sidebarTitle}</h2>
              <button 
                className={styles.closeButton}
                onClick={onCloseSidebar}
                aria-label="Close sidebar"
              >
                ×
              </button>
            </div>
            <div className={styles.sidebarContent}>
              {sidebarContent}
            </div>
          </aside>
        )}
      </main>
    </div>
  );
};

export default Layout; 