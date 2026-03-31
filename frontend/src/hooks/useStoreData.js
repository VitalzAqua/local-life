import { useState, useEffect, useCallback } from 'react';
import apiService from '../services/apiService';

export const useStoreData = () => {
  const [stores, setStores] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastSearch, setLastSearch] = useState({ query: '', categories: [] });

  const fetchCategories = useCallback(async () => {
    try {
      const categories = await apiService.getCategories();
      setCategories(categories);
    } catch (err) {
      console.error('Error fetching categories:', err);
      setError('Failed to load categories');
    }
  }, []);

  const searchStores = useCallback(async (query = '', selectedCategories = []) => {
    setLoading(true);
    setError(null);
    
    try {
      let stores = [];
      
      if (query.trim()) {
        console.log('🔍 Searching stores with query:', query, 'categories:', selectedCategories);
        stores = await apiService.searchStores(query, selectedCategories);
      } else if (selectedCategories.length > 0) {
        console.log('🔍 Fetching stores by categories:', selectedCategories);
        stores = await apiService.getStoresByCategories(selectedCategories);
      } else {
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
    searchStores('', []);
    setLastSearch({ query: '', categories: [] });
    setError(null);
  }, [searchStores]);

  const clearMap = useCallback(() => {
    setStores([]);
    setLastSearch({ query: '', categories: [] });
    setError(null);
  }, []);

  useEffect(() => {
    fetchCategories();
    searchStores('', []);
  }, [fetchCategories, searchStores]);

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
