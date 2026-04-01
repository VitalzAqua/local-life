import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BASE_URL } from '../../config/api';
import styles from './EnhancedSearchInput.module.css';

const normalizeBrandKey = (value = '') =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const formatDistance = (distanceKm) =>
  Number.isFinite(distanceKm) ? `${distanceKm.toFixed(1)} km away` : null;

const ordinalLabel = (index) => {
  if (index === 1) return 'Nearest';
  if (index === 2) return '2nd nearest';
  if (index === 3) return '3rd nearest';
  return `${index}th nearest`;
};

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

const buildSuggestions = (stores = [], hasUserLocation) => {
  const brandGroups = new Map();

  stores.forEach(store => {
    const brandKey = normalizeBrandKey(store.name);
    if (!brandKey) {
      return;
    }

    if (!brandGroups.has(brandKey)) {
      brandGroups.set(brandKey, {
        brand: store.name,
        stores: [],
        topScore: store.score || 0,
        nearestDistance: Number.isFinite(store.distance_km) ? store.distance_km : Number.POSITIVE_INFINITY
      });
    }

    const group = brandGroups.get(brandKey);
    group.stores.push(store);
    group.topScore = Math.max(group.topScore, store.score || 0);
    if (Number.isFinite(store.distance_km)) {
      group.nearestDistance = Math.min(group.nearestDistance, store.distance_km);
    }
  });

  const sortedGroups = Array.from(brandGroups.values())
    .map(group => ({
      ...group,
      stores: group.stores
        .slice()
        .sort((a, b) => {
          const aDistance = Number.isFinite(a.distance_km) ? a.distance_km : Number.POSITIVE_INFINITY;
          const bDistance = Number.isFinite(b.distance_km) ? b.distance_km : Number.POSITIVE_INFINITY;

          if (aDistance !== bDistance) {
            return aDistance - bDistance;
          }

          return (b.score || 0) - (a.score || 0);
        })
    }))
    .sort((a, b) => {
      if (b.topScore !== a.topScore) {
        return b.topScore - a.topScore;
      }

      if (b.stores.length !== a.stores.length) {
        return b.stores.length - a.stores.length;
      }

      return a.nearestDistance - b.nearestDistance;
    });

  const suggestions = [];

  sortedGroups.forEach(group => {
    const aggregateLabel = hasUserLocation
      ? `All nearby ${group.brand} near you`
      : `All ${group.brand} locations`;

    suggestions.push({
      type: 'allNearby',
      name: aggregateLabel,
      inputValue: group.brand,
      brand: group.brand,
      count: group.stores.length,
      stores: group.stores,
      icon: '🏪',
      meta: [
        `${group.stores.length} ${group.stores.length === 1 ? 'location' : 'locations'}`,
        formatDistance(group.stores[0]?.distance_km)
      ].filter(Boolean).join(' • ')
    });

    group.stores.slice(0, 4).forEach((store, index) => {
      suggestions.push({
        type: 'store',
        name: group.stores.length > 1 ? `${ordinalLabel(index + 1)} ${group.brand}` : store.name,
        inputValue: store.name,
        address: store.address || 'Address not available',
        lat: parseFloat(store.lat) || 0,
        lng: parseFloat(store.lng) || 0,
        category: store.category || 'general',
        icon: getStoreIcon(store.category),
        storeData: store,
        meta: [formatDistance(store.distance_km), store.address].filter(Boolean).join(' • ')
      });
    });
  });

  return suggestions.slice(0, 15);
};

const EnhancedSearchInput = ({
  value,
  onChange,
  onSearch,
  onLocationSelect,
  userLocation,
  placeholder = 'Search for stores...'
}) => {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const abortControllerRef = useRef(null);

  const searchStores = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setIsLoading(true);

    try {
      const params = new URLSearchParams({
        q: searchQuery,
        limit: '40'
      });

      if (userLocation?.lat != null && userLocation?.lng != null) {
        params.set('lat', String(userLocation.lat));
        params.set('lng', String(userLocation.lng));
      }

      const response = await fetch(
        `${BASE_URL}/api/search/global?${params.toString()}`,
        { signal: abortControllerRef.current.signal }
      );

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();
      const stores = data.stores || [];
      const newSuggestions = buildSuggestions(
        stores,
        userLocation?.lat != null && userLocation?.lng != null
      );

      setSuggestions(newSuggestions);
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
  }, [userLocation]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchStores(query);
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [query, searchStores]);

  useEffect(() => {
    if (value !== undefined && value !== query) {
      setQuery(value);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setQuery(newValue);
    if (onChange) onChange(e);

    if (newValue.length === 0) {
      setSuggestions([]);
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    if (!suggestion) return;

    if (suggestion.type === 'allNearby') {
      setQuery(suggestion.inputValue || suggestion.name || '');
      setShowSuggestions(false);

      if (onLocationSelect) {
        onLocationSelect({
          type: 'allNearby',
          name: suggestion.name || '',
          brand: suggestion.brand || '',
          inputValue: suggestion.inputValue || suggestion.brand || '',
          stores: suggestion.stores || []
        });
      }

      return;
    }

    if (suggestion.type === 'store') {
      setQuery(suggestion.inputValue || suggestion.name || '');
      setShowSuggestions(false);

      if (onLocationSelect) {
        onLocationSelect({
          type: 'store',
          name: suggestion.name || '',
          inputValue: suggestion.inputValue || suggestion.name || '',
          address: suggestion.address || '',
          lat: suggestion.lat || 0,
          lng: suggestion.lng || 0,
          category: suggestion.category || 'general',
          storeData: suggestion.storeData || null
        });
      }
    }
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleSuggestionClick(suggestions[selectedIndex]);
        } else if (onSearch && query.trim()) {
          setShowSuggestions(false);
          onSearch(query.trim());
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
      default:
        break;
    }
  };

  const handleFocus = () => {
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleBlur = () => {
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
              key={`${suggestion.type}-${suggestion.inputValue || suggestion.name}-${index}`}
              className={`${styles.suggestion} ${
                index === selectedIndex ? styles.selected : ''
              } ${styles[suggestion.type]}`}
              onClick={() => handleSuggestionClick(suggestion)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className={styles.suggestionIcon}>{suggestion.icon}</div>
              <div className={styles.suggestionContent}>
                <div className={styles.suggestionName}>{suggestion.name}</div>
                {suggestion.meta && (
                  <div className={styles.suggestionMeta}>{suggestion.meta}</div>
                )}
                {suggestion.category && (
                  <div className={styles.suggestionCategory}>{suggestion.category}</div>
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
