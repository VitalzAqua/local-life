// Authentication utility functions
export const AUTH_STORAGE_KEYS = {
  USER: 'user',
  USER_TOKEN: 'userToken',
  ADMIN_TOKEN: 'adminToken'
};

export const getUserToken = () => localStorage.getItem(AUTH_STORAGE_KEYS.USER_TOKEN);

export const getAdminToken = () => sessionStorage.getItem(AUTH_STORAGE_KEYS.ADMIN_TOKEN);

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
 * Get user ID from stored session state
 */
export const getUserId = (user = null) => {
  if (user?.id) {
    return user.id.toString();
  }

  const storedUser = getStoredUser();
  return storedUser?.id ? storedUser.id.toString() : null;
};

/**
 * Store user session data
 */
export const storeUserSession = (sessionData) => {
  try {
    const user = sessionData?.user || null;
    const token = sessionData?.token || null;

    if (!user || !token) {
      throw new Error('Missing user session payload');
    }

    localStorage.setItem(AUTH_STORAGE_KEYS.USER, JSON.stringify(user));
    localStorage.setItem(AUTH_STORAGE_KEYS.USER_TOKEN, token);
  } catch (error) {
    console.error('Error storing user session:', error);
  }
};

/**
 * Clear user session
 */
export const clearUserSession = () => {
  localStorage.removeItem(AUTH_STORAGE_KEYS.USER);
  localStorage.removeItem(AUTH_STORAGE_KEYS.USER_TOKEN);
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = () => {
  const user = getStoredUser();
  const token = getUserToken();
  return !!(user && token);
};

/**
 * Store short-lived admin session token in sessionStorage.
 */
export const storeAdminSession = (sessionData) => {
  const token = sessionData?.token;
  if (!token) return;
  sessionStorage.setItem(AUTH_STORAGE_KEYS.ADMIN_TOKEN, token);
};

export const clearAdminSession = () => {
  sessionStorage.removeItem(AUTH_STORAGE_KEYS.ADMIN_TOKEN);
};

export const isAdminAuthenticated = () => {
  return !!getAdminToken();
};

/**
 * Validate user session and clean up if invalid
 */
export const validateUserSession = () => {
  const user = getStoredUser();
  const token = getUserToken();
  
  if (!user || !token) {
    clearUserSession();
    return null;
  }
  
  if (!user.id) {
    console.warn('Invalid stored user session detected, cleaning up...');
    clearUserSession();
    return null;
  }
  
  return user;
};
