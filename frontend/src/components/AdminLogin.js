import React, { useState } from 'react';
import styles from './AdminLogin.module.css';

const AdminLogin = ({ onAdminLogin, onClose }) => {
  const [adminCode, setAdminCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const ADMIN_CODE = process.env.REACT_APP_ADMIN_CODE;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    setTimeout(() => {
      if (ADMIN_CODE && adminCode === ADMIN_CODE) {
        onAdminLogin();
      } else {
        setError('Invalid admin code. Access denied.');
        setAdminCode('');
      }
      setIsLoading(false);
    }, 500);
  };

  return (
    <div className={styles.adminLoginOverlay}>
      <div className={styles.adminLoginModal}>
        <div className={styles.adminLoginHeader}>
          <h2>🔐 Admin Access Required</h2>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <div className={styles.adminLoginContent}>
          <p>Enter the admin code to access the dashboard:</p>
          
          <form onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label htmlFor="adminCode">Admin Code:</label>
              <input
                type="password"
                id="adminCode"
                value={adminCode}
                onChange={(e) => setAdminCode(e.target.value)}
                placeholder="Enter admin code"
                required
                autoFocus
                disabled={isLoading}
              />
            </div>

            {error && <div className={styles.adminLoginError}>{error}</div>}

            <div className={styles.adminLoginActions}>
              <button 
                type="submit" 
                className={styles.adminLoginBtn}
                disabled={isLoading || !adminCode.trim()}
              >
                {isLoading ? 'Verifying...' : 'Access Admin Dashboard'}
              </button>
              <button 
                type="button" 
                className={styles.cancelBtn}
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
};

export default AdminLogin; 