// Cleanup utility to remove any existing admin authentication from localStorage
// This ensures that users who previously had admin auth stored will need to re-authenticate

export const cleanupAdminAuth = () => {
  try {
    // Remove any existing admin authentication
    localStorage.removeItem('adminAuthenticated');
    
    // Also remove any variations that might exist
    const keysToRemove = ['admin_auth', 'isAdminAuth', 'adminAuth'];
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
    
    console.log('🔐 Admin authentication cleanup completed - re-authentication required');
  } catch (error) {
    console.error('Error during admin auth cleanup:', error);
  }
};

// Auto-run cleanup when module is imported
cleanupAdminAuth(); 