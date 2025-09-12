import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './EnhancedSearchInput.module.css';

const EnhancedSearchInput = ({ onLocationSelect, placeholder = "Search for stores..." }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Search database stores
  const searchStores = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setIsLoading(true);

    try {
      const response = await fetch(
        `http://localhost:3001/api/search/global?q=${encodeURIComponent(searchQuery)}&limit=20`,
        { signal: abortControllerRef.current.signal }
      );

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();
      const stores = data.stores || [];

      // Group stores by brand name
      const brandGroups = {};
      stores.forEach(store => {
        const brandName = store.name.toLowerCase();
        if (!brandGroups[brandName]) {
          brandGroups[brandName] = [];
        }
        brandGroups[brandName].push(store);
      });

      // Create suggestions array
      const newSuggestions = [];

      // For each brand, add "All nearby [Brand]" option and individual stores
      Object.keys(brandGroups).forEach(brandName => {
        const brandStores = brandGroups[brandName];
        const displayName = brandStores[0].name; // Use original casing

        // Add "All nearby [Brand]" option if there are multiple locations
        if (brandStores.length > 1) {
          newSuggestions.push({
            type: 'allNearby',
            name: `All nearby ${displayName}`,
            brand: displayName,
            count: brandStores.length,
            stores: brandStores,
            icon: '🏪'
          });
        }

        // Add individual store locations
        brandStores.forEach(store => {
          newSuggestions.push({
            type: 'store',
            name: store.name || 'Unknown Store',
            address: store.address || 'Address not available',
            lat: parseFloat(store.lat) || 0,
            lng: parseFloat(store.lng) || 0,
            category: store.category || 'general',
            icon: getStoreIcon(store.category)
          });
        });
      });

      setSuggestions(newSuggestions.slice(0, 15)); // Limit to 15 results
      setShowSuggestions(newSuggestions.length > 0);
      setSelectedIndex(-1);

    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Store search error:', error);
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get icon for store category
  const getStoreIcon = (category) => {
    const iconMap = {
      restaurant: '🍽️',
      cafe: '☕',
      grocery: '🛒',
      pharmacy: '💊',
      gym: '💪',
      retail: '🛍️',
      service: '🔧'
    };
    return iconMap[category] || '🏪';
  };

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchStores(query);
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [query, searchStores]);

  // Handle input change
  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    
    if (value.length === 0) {
      setSuggestions([]);
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion) => {
    if (!suggestion) return;
    
    if (suggestion.type === 'allNearby') {
      // Handle "All nearby [Brand]" selection
      setQuery(suggestion.name || '');
      setShowSuggestions(false);
      
      if (onLocationSelect) {
        onLocationSelect({
          type: 'allNearby',
          name: suggestion.name || '',
          brand: suggestion.brand || '',
          stores: suggestion.stores || []
        });
      }
    } else if (suggestion.type === 'store') {
      // Handle individual store selection
      setQuery(suggestion.name || '');
      setShowSuggestions(false);
      
      if (onLocationSelect) {
        onLocationSelect({
          type: 'store',
          name: suggestion.name || '',
          address: suggestion.address || '',
          lat: suggestion.lat || 0,
          lng: suggestion.lng || 0,
          category: suggestion.category || 'general'
        });
      }
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleSuggestionClick(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  // Handle input focus
  const handleFocus = () => {
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  // Handle input blur
  const handleBlur = (e) => {
    // Delay hiding suggestions to allow click events
    setTimeout(() => {
      if (!suggestionsRef.current?.contains(document.activeElement)) {
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    }, 150);
  };

  return (
    <div className={styles.searchContainer}>
      <div className={styles.inputContainer}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={styles.searchInput}
          autoComplete="off"
        />
        
        {isLoading && (
          <div className={styles.loadingIndicator}>
            <div className={styles.spinner}></div>
          </div>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div ref={suggestionsRef} className={styles.suggestionsContainer}>
          {suggestions.map((suggestion, index) => (
            <div
              key={`${suggestion.type}-${suggestion.name}-${index}`}
              className={`${styles.suggestion} ${
                index === selectedIndex ? styles.selected : ''
              } ${styles[suggestion.type]}`}
              onClick={() => handleSuggestionClick(suggestion)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className={styles.suggestionIcon}>
                {suggestion.icon}
              </div>
              <div className={styles.suggestionContent}>
                <div className={styles.suggestionName}>
                  {suggestion.name}
                </div>
                {suggestion.type === 'allNearby' && (
                  <div className={styles.suggestionMeta}>
                    {suggestion.count} locations
                  </div>
                )}
                {suggestion.type === 'store' && suggestion.address && (
                  <div className={styles.suggestionMeta}>
                    {suggestion.address}
                  </div>
                )}
                {suggestion.category && (
                  <div className={styles.suggestionCategory}>
                    {suggestion.category}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EnhancedSearchInput; 