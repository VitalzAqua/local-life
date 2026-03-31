import { useCallback, useEffect, useState } from 'react';
import apiService from '../services/apiService';
import {
  clearAdminSession,
  isAdminAuthenticated,
  storeAdminSession
} from '../utils/auth';
import { usePollingEffect } from './usePollingEffect';

const ADMIN_AUTH_ERROR = 'Admin authentication required';

const getDriverFetchError = (error) =>
  error?.response?.data?.error || error?.message || 'Failed to load drivers';

export const useDriverTracking = (user) => {
  const userId = user?.id || null;
  const [drivers, setDrivers] = useState([]);
  const [driversLoading, setDriversLoading] = useState(false);
  const [driversError, setDriversError] = useState(null);
  const [isAdminMode, setIsAdminMode] = useState(isAdminAuthenticated());
  const [showAdminPasswordModal, setShowAdminPasswordModal] = useState(false);

  const disableAdminMode = useCallback(() => {
    clearAdminSession();
    setIsAdminMode(false);
    setShowAdminPasswordModal(false);
  }, []);

  const loadDrivers = useCallback(async ({ showLoading = true } = {}) => {
    if (!userId && !isAdminMode) {
      setDrivers([]);
      setDriversError(null);
      setDriversLoading(false);
      return;
    }

    if (showLoading) {
      setDriversLoading(true);
    }

    setDriversError(null);

    try {
      const fetchedDrivers = isAdminMode
        ? await apiService.getAllDriversAdmin()
        : await apiService.getUserDeliveryDrivers(userId);

      setDrivers(fetchedDrivers);
    } catch (error) {
      const message = getDriverFetchError(error);
      setDriversError(message);

      if (message.includes(ADMIN_AUTH_ERROR)) {
        disableAdminMode();
      }
    } finally {
      if (showLoading) {
        setDriversLoading(false);
      }
    }
  }, [disableAdminMode, isAdminMode, userId]);

  useEffect(() => {
    loadDrivers();
  }, [loadDrivers]);

  usePollingEffect(
    () => {
      loadDrivers({ showLoading: false });
    },
    3000,
    Boolean(userId || isAdminMode),
    { runImmediately: false }
  );

  const handleAdminModeToggle = useCallback(() => {
    if (!isAdminMode) {
      setShowAdminPasswordModal(true);
      return;
    }

    disableAdminMode();
  }, [disableAdminMode, isAdminMode]);

  const handleAdminPasswordSubmit = useCallback(async (password) => {
    setDriversLoading(true);
    setDriversError(null);

    try {
      const adminSession = await apiService.adminLogin(password);
      storeAdminSession(adminSession);
      setIsAdminMode(true);
      setShowAdminPasswordModal(false);
    } catch (error) {
      setDriversError(getDriverFetchError(error) || 'Invalid admin password');
    } finally {
      setDriversLoading(false);
    }
  }, []);

  return {
    drivers,
    driversError,
    driversLoading,
    handleAdminModeToggle,
    handleAdminPasswordSubmit,
    isAdminMode,
    setShowAdminPasswordModal,
    showAdminPasswordModal
  };
};
