import { useState, useCallback } from 'react';

export const useMapControls = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [radius, setRadius] = useState('all');
  const [customRadius, setCustomRadius] = useState('');

  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedCategories([]);
    setRadius('all');
    setCustomRadius('');
  }, []);

  const setRadiusWithValidation = useCallback((newRadius) => {
    setRadius(newRadius);
    if (newRadius !== 'custom') {
      setCustomRadius('');
    }
  }, []);

  const setCustomRadiusWithValidation = useCallback((value) => {
    // Validate custom radius input
    if (value === '' || (parseFloat(value) > 0 && parseFloat(value) <= 100)) {
      setCustomRadius(value);
    }
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    selectedCategories,
    setSelectedCategories,
    radius,
    setRadius: setRadiusWithValidation,
    customRadius,
    setCustomRadius: setCustomRadiusWithValidation,
    resetFilters
  };
}; 