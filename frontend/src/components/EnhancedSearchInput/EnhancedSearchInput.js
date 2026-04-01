import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BASE_URL } from '../../config/api';
import styles from './EnhancedSearchInput.module.css';

const TORONTO_PLACE = {
  id: 'featured-toronto',
  type: 'place',
  name: 'Toronto',
  address: 'Toronto, ON, Canada',
  lat: 43.6532,
  lng: -79.3832,
  icon: '📍',
  meta: 'City in Ontario'
};

const normalizeBrandKey = (value = '') =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const normalizeSearchValue = (value = '') =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

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

const formatPlaceAddress = (addressComponents = {}, fallback = '') => {
  const parts = [];
  const city =
    addressComponents.city ||
    addressComponents.town ||
    addressComponents.village ||
    addressComponents.municipality ||
    addressComponents.county;
  const region =
    addressComponents.state ||
    addressComponents.province ||
    addressComponents['ISO3166-2-lvl4'];
  const country = addressComponents.country;

  if (city) parts.push(city);
  if (region) parts.push(String(region).replace(/^[A-Z]{2}-/, ''));
  if (country && !['Canada', 'United States', 'United States of America'].includes(country)) {
    parts.push(country);
  }

  return parts.join(', ') || fallback;
};

const buildPlaceSuggestions = (places = [], query = '') => {
  const normalizedQuery = normalizeSearchValue(query).replace(/\s+/g, '');
  const suggestions = [];

  if ('toronto'.startsWith(normalizedQuery) && normalizedQuery.length > 0) {
    suggestions.push(TORONTO_PLACE);
  }

  places.forEach(place => {
    if (!place || place.lat == null || place.lon == null) {
      return;
    }

    const formatted = {
      id: `place-${place.place_id}`,
      type: 'place',
      name: place.name || place.address?.city || place.address?.town || place.display_name.split(',')[0],
      address: formatPlaceAddress(place.address, place.display_name),
      lat: parseFloat(place.lat),
      lng: parseFloat(place.lon),
      icon: '📍',
      meta: place.type ? `Place • ${String(place.type).replace(/_/g, ' ')}` : 'Place'
    };

    const isDuplicateToronto =
      normalizeSearchValue(formatted.name).replace(/\s+/g, '') === 'toronto' &&
      suggestions.some(suggestion => suggestion.id === TORONTO_PLACE.id);

    if (!isDuplicateToronto) {
      suggestions.push(formatted);
    }
  });

  return suggestions.slice(0, 5);
};

const mergeSuggestions = (storeSuggestions = [], placeSuggestions = []) => {
  if (placeSuggestions.length === 0) {
    return storeSuggestions.slice(0, 15);
  }

  if (storeSuggestions.length === 0) {
    return placeSuggestions.slice(0, 15);
  }

  const merged = [];
  let storeIndex = 0;
  let placeIndex = 0;

  if (storeSuggestions[0]) {
    merged.push(storeSuggestions[0]);
    storeIndex += 1;
  }

  while ((storeIndex < storeSuggestions.length || placeIndex < placeSuggestions.length) && merged.length < 15) {
    if (placeIndex < placeSuggestions.length) {
      merged.push(placeSuggestions[placeIndex]);
      placeIndex += 1;
    }

    if (storeIndex < storeSuggestions.length && merged.length < 15) {
      merged.push(storeSuggestions[storeIndex]);
      storeIndex += 1;
    }
  }

  return merged.slice(0, 15);
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
  const suppressSuggestionsRef = useRef(false);

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

      const storeRequest = fetch(
        `${BASE_URL}/api/search/global?${params.toString()}`,
        { signal: abortControllerRef.current.signal }
      );

      const placeRequest = searchQuery.length >= 2
        ? fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&addressdetails=1&countrycodes=ca&viewbox=-79.639,43.855,-79.115,43.585&bounded=0`,
            { signal: abortControllerRef.current.signal }
          )
        : Promise.resolve(null);

      const [storeResult, placeResult] = await Promise.allSettled([storeRequest, placeRequest]);

      if (storeResult.status !== 'fulfilled' || !storeResult.value.ok) {
        const status = storeResult.status === 'fulfilled' ? storeResult.value.status : 'request failed';
        throw new Error(`Search failed: ${status}`);
      }

      const storeData = await storeResult.value.json();
      const stores = storeData.stores || [];
      const storeSuggestions = buildSuggestions(
        stores,
        userLocation?.lat != null && userLocation?.lng != null
      );

      let placeSuggestions = buildPlaceSuggestions([], searchQuery);
      if (placeResult.status === 'fulfilled' && placeResult.value?.ok) {
        const placeData = await placeResult.value.json();
        placeSuggestions = buildPlaceSuggestions(placeData, searchQuery);
      }

      const newSuggestions = mergeSuggestions(storeSuggestions, placeSuggestions);

      setSuggestions(newSuggestions);
      setShowSuggestions(
        newSuggestions.length > 0 &&
        !suppressSuggestionsRef.current &&
        document.activeElement === inputRef.current
      );
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
    suppressSuggestionsRef.current = false;
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

    suppressSuggestionsRef.current = true;
    setSelectedIndex(-1);

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

    if (suggestion.type === 'place') {
      setQuery(suggestion.address || suggestion.name || '');
      setShowSuggestions(false);

      if (onLocationSelect) {
        onLocationSelect({
          type: 'place',
          name: suggestion.name || '',
          address: suggestion.address || '',
          lat: suggestion.lat || 0,
          lng: suggestion.lng || 0
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
    suppressSuggestionsRef.current = false;
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
