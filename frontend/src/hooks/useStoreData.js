import { useState, useEffect, useCallback } from 'react';
import { ENDPOINTS } from '../config/api';
import apiService from '../services/apiService';

export const useStoreData = () => {
  const [stores, setStores] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastSearch, setLastSearch] = useState({ query: '', categories: [] });

  const fetchCategories = async () => {
    try {
      console.log('🏷️ Fetching categories...');
      const url = ENDPOINTS.CATEGORIES;
      console.log('🏷️ Categories URL:', url);
      const categories = await apiService.getCategories();
      console.log('🏷️ Categories API response:', categories);
      setCategories(categories);
      console.log('🏷️ Categories set in state:', categories);
    } catch (err) {
      console.error('🏷️ Error fetching categories:', err);
      console.error('🏷️ Error details:', {
        message: err.message,
        response: err.response,
        status: err.response?.status,
        data: err.response?.data
      });
      setError('Failed to load categories');
    }
  };

  const searchStores = useCallback(async (query = '', selectedCategories = []) => {
    setLoading(true);
    setError(null);
    
    try {
      let stores = [];
      
      if (query.trim()) {
        // Text search
        console.log('🔍 Searching stores with query:', query, 'categories:', selectedCategories);
        stores = await apiService.searchStores(query, selectedCategories);
      } else if (selectedCategories.length > 0) {
        // Category filter only
        console.log('🔍 Fetching stores by categories:', selectedCategories);
        stores = await apiService.getStoresByCategories(selectedCategories);
      } else {
        // No filters - show all stores
        console.log('🔍 Fetching all stores (no filters)');
        stores = await apiService.getStoresByCategories([]);
      }
      
      console.log('🔍 Stores fetched:', stores.length);
      setStores(stores);
      setLastSearch({ query, categories: selectedCategories });
    } catch (err) {
      console.error('🔍 Error fetching stores:', err);
      setError('Failed to load stores');
      setStores([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearSearch = useCallback(() => {
    // Instead of clearing stores, reload all stores to show the full map
    searchStores('', []); // This will show all stores
    setLastSearch({ query: '', categories: [] });
    setError(null);
  }, [searchStores]);

  const clearMap = useCallback(() => {
    // Clear all store icons from the map
    setStores([]);
    setLastSearch({ query: '', categories: [] });
    setError(null);
  }, []);

  // Fetch available categories and initial stores on mount
  useEffect(() => {
    fetchCategories();
    // Load all stores initially
    searchStores('', []);
  }, [searchStores]);

  return {
    stores,
    categories,
    loading,
    error,
    searchStores,
    clearSearch,
    clearMap,
    lastSearch
  };
}; 