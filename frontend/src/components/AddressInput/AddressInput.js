import React, { useState, useEffect, useRef } from 'react';
import styles from './AddressInput.module.css';

const AddressInput = ({ onAddressSelect, placeholder = "Enter your address", initialValue = "" }) => {
  const [query, setQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [error, setError] = useState('');
  const [suggestionsPosition, setSuggestionsPosition] = useState({ top: 0, left: 0, width: 0 });
  
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const debounceRef = useRef(null);

  // Debounced search function
  const searchAddresses = async (searchQuery) => {
    if (!searchQuery || searchQuery.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Use Nominatim API for address search with better parameters
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=8&addressdetails=1&countrycodes=ca,us&bounded=0&dedupe=1&extratags=1`,
        {
          headers: {
            'User-Agent': 'LocalLifeApp/1.0'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to search addresses');
      }

      const data = await response.json();
      
      // Format suggestions with readable addresses
      const formattedSuggestions = data.map(item => ({
        id: item.place_id,
        display_name: item.display_name,
        formatted_address: formatAddress(item.address),
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        address_components: item.address,
        type: item.type,
        importance: item.importance
      }));

      // Sort by importance (relevance)
      formattedSuggestions.sort((a, b) => (b.importance || 0) - (a.importance || 0));

      setSuggestions(formattedSuggestions);
      setShowSuggestions(true);
      setSelectedIndex(-1);
      
      // Calculate position for fixed positioning
      if (inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect();
        setSuggestionsPosition({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width
        });
      }
    } catch (err) {
      console.error('Address search error:', err);
      setError('Failed to search addresses. Please try again.');
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setLoading(false);
    }
  };

  // Format address from components
  const formatAddress = (addressComponents) => {
    if (!addressComponents) return '';

    const parts = [];
    
    // Add house number and street (street address line)
    if (addressComponents.house_number && addressComponents.road) {
      parts.push(`${addressComponents.house_number} ${addressComponents.road}`);
    } else if (addressComponents.road) {
      parts.push(addressComponents.road);
    }

    // Add city/town (most important for identification)
    const city = addressComponents.city || addressComponents.town || addressComponents.village || addressComponents.municipality;
    if (city) {
      parts.push(city);
    }

    // Add state/province
    const region = addressComponents.state || addressComponents.province || addressComponents['ISO3166-2-lvl4'];
    if (region) {
      // Clean up region format (remove country prefix if present)
      const cleanRegion = region.replace(/^[A-Z]{2}-/, '');
      parts.push(cleanRegion);
    }

    // Add postal code (format properly for different countries)
    if (addressComponents.postcode) {
      let postalCode = addressComponents.postcode;
      
      // Format Canadian postal codes (A1A 1A1)
      if (addressComponents.country_code === 'ca' && postalCode.length === 6) {
        postalCode = `${postalCode.substring(0, 3)} ${postalCode.substring(3)}`;
      }
      
      parts.push(postalCode);
    }

    // Add country if not Canada/US (since we're filtering for those)
    const country = addressComponents.country;
    if (country && !['Canada', 'United States', 'United States of America'].includes(country)) {
      parts.push(country);
    }

    return parts.join(', ');
  };

  // Handle input change with debouncing
  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    setError('');

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce search
    debounceRef.current = setTimeout(() => {
      searchAddresses(value);
    }, 300);
  };

  // Handle suggestion selection
  const handleSuggestionClick = (suggestion) => {
    setQuery(suggestion.formatted_address || suggestion.display_name);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    
    // Call the callback with address data
    onAddressSelect({
      address: suggestion.formatted_address || suggestion.display_name,
      lat: suggestion.lat,
      lng: suggestion.lng,
      components: suggestion.address_components,
      placeId: suggestion.id
    });
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSuggestionClick(suggestions[selectedIndex]);
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

  // Handle input focus
  const handleFocus = () => {
    if (suggestions.length > 0) {
      setShowSuggestions(true);
      
      // Update position when showing suggestions
      if (inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect();
        setSuggestionsPosition({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width
        });
      }
    }
  };

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        inputRef.current && !inputRef.current.contains(event.target) &&
        suggestionsRef.current && !suggestionsRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div className={styles.addressInput}>
      <div className={styles.inputContainer}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={placeholder}
          className={`${styles.input} ${error ? styles.error : ''}`}
          autoComplete="off"
        />
        
        {loading && (
          <div className={styles.loadingIcon}>
            <div className={styles.spinner}></div>
          </div>
        )}
      </div>

      {error && (
        <div className={styles.errorMessage}>
          {error}
        </div>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <div 
          ref={suggestionsRef} 
          className={styles.suggestions}
          style={{
            top: `${suggestionsPosition.top}px`,
            left: `${suggestionsPosition.left}px`,
            width: `${Math.max(suggestionsPosition.width, 300)}px`
          }}
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={suggestion.id}
              className={`${styles.suggestion} ${
                index === selectedIndex ? styles.selected : ''
              }`}
              onClick={() => handleSuggestionClick(suggestion)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className={styles.primaryText}>
                {suggestion.formatted_address}
              </div>
              {suggestion.formatted_address !== suggestion.display_name && (
                <div className={styles.secondaryText}>
                  {suggestion.display_name}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showSuggestions && suggestions.length === 0 && query.length >= 3 && !loading && (
        <div 
          className={styles.noResults}
          style={{
            top: `${suggestionsPosition.top}px`,
            left: `${suggestionsPosition.left}px`,
            width: `${Math.max(suggestionsPosition.width, 300)}px`
          }}
        >
          No addresses found. Please try a different search.
        </div>
      )}
    </div>
  );
};

export default AddressInput; 