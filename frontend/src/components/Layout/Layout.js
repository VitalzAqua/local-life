import React from 'react';
import styles from './Layout.module.css';

const Layout = ({ 
  user, 
  userAddress,
  onLogout, 
  onShowOrders, 
  onShowAdmin,
  onChangeLocation,
  sidebarContent,
  sidebarTitle,
  onCloseSidebar,
  children 
}) => {
      return (
      <div className={styles.appLayout}>
        {/* Simplified Header */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <h1 className={styles.headerTitle}>Local Life Platform</h1>
            {userAddress && (
              <div className={styles.locationInfo}>
                <span className={styles.locationIcon}>📍</span>
                <span className={styles.locationText}>{userAddress}</span>
                <button 
                  className={styles.changeLocationBtn}
                  onClick={onChangeLocation}
                  title="Change your location"
                >
                  Change
                </button>
              </div>
            )}
          </div>
          
          {user && (
            <div className={styles.userSection}>
              <span className={styles.userWelcome}>Welcome, {user.name}!</span>
              <div className={styles.actionButtons}>
                <button 
                  className="btn btn-success"
                  onClick={onShowOrders}
                  title="View your orders and reservations"
                >
                  📋 My Orders
                </button>
                <button 
                  className="btn btn-secondary"
                  onClick={onShowAdmin}
                  title="Manage orders and reservations"
                >
                  🛠️ Admin
                </button>
                <button 
                  className="btn btn-outline"
                  onClick={onLogout}
                >
                  Logout
                </button>
              </div>
            </div>
          )}
        </header>

        {/* Main Content Area */}
        <main className={styles.mainContent}>
          {/* Map Section */}
          <div className={styles.mapSection}>
            {children}
          </div>

          {/* Sidebar */}
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