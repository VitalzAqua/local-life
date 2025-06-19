// Authentication utility functions
export const AUTH_STORAGE_KEYS = {
  USER: 'user',
  USER_ID: 'userId',
  ADMIN_AUTH: 'adminAuthenticated'
};

/**
 * Get user ID from multiple sources with fallback strategies
 */
export const getUserId = (user = null) => {
  // Try direct userId storage first
  let userId = localStorage.getItem(AUTH_STORAGE_KEYS.USER_ID);
  
  // Fallback to user prop if available
  if (!userId && user?.id) {
    userId = user.id.toString();
    localStorage.setItem(AUTH_STORAGE_KEYS.USER_ID, userId);
  }
  
  // Fallback to parsing stored user object
  if (!userId) {
    const storedUser = localStorage.getItem(AUTH_STORAGE_KEYS.USER);
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        if (userData.id) {
          userId = userData.id.toString();
          localStorage.setItem(AUTH_STORAGE_KEYS.USER_ID, userId);
        }
      } catch (parseError) {
        console.error('Error parsing stored user:', parseError);
        // Clean up corrupted data
        localStorage.removeItem(AUTH_STORAGE_KEYS.USER);
      }
    }
  }
  
  return userId;
};

/**
 * Get stored user data
 */
export const getStoredUser = () => {
  try {
    const storedUser = localStorage.getItem(AUTH_STORAGE_KEYS.USER);
    return storedUser ? JSON.parse(storedUser) : null;
  } catch (error) {
    console.error('Error parsing stored user:', error);
    localStorage.removeItem(AUTH_STORAGE_KEYS.USER);
    return null;
  }
};

/**
 * Store user session data
 */
export const storeUserSession = (userData) => {
  try {
    localStorage.setItem(AUTH_STORAGE_KEYS.USER, JSON.stringify(userData));
    if (userData.id) {
      localStorage.setItem(AUTH_STORAGE_KEYS.USER_ID, userData.id.toString());
    }
  } catch (error) {
    console.error('Error storing user session:', error);
  }
};

/**
 * Clear user session
 */
export const clearUserSession = () => {
  localStorage.removeItem(AUTH_STORAGE_KEYS.USER);
  localStorage.removeItem(AUTH_STORAGE_KEYS.USER_ID);
  // Also clear admin auth if it exists (for cleanup)
  localStorage.removeItem(AUTH_STORAGE_KEYS.ADMIN_AUTH);
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = () => {
  const userId = getUserId();
  const user = getStoredUser();
  return !!(userId && user);
};

/**
 * Admin authentication helpers
 * Note: Admin authentication is NOT persisted for security - requires re-authentication each time
 */
export const isAdminAuthenticated = () => {
  // Always return false to force re-authentication
  return false;
};

export const setAdminAuthenticated = (authenticated = true) => {
  // Do not persist admin authentication to localStorage for security
  // Admin must re-authenticate each time they want to access the dashboard
  console.log('Admin authentication set to:', authenticated, '(not persisted)');
};

/**
 * Validate user session and clean up if invalid
 */
export const validateUserSession = () => {
  const user = getStoredUser();
  const userId = getUserId();
  
  if (!user || !userId) {
    clearUserSession();
    return null;
  }
  
  // Ensure consistency between stored user and userId
  if (user.id.toString() !== userId) {
    console.warn('User session inconsistency detected, cleaning up...');
    clearUserSession();
    return null;
  }
  
  return user;
}; 