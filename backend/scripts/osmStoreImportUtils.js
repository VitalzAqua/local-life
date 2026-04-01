const GROCERY_SHOPS = new Set([
  'bakery',
  'butcher',
  'cheese',
  'convenience',
  'deli',
  'food',
  'greengrocer',
  'grocery',
  'health_food',
  'seafood',
  'supermarket'
]);

const PHARMACY_SHOPS = new Set(['chemist', 'medical_supply', 'pharmacy']);
const RESTAURANT_AMENITIES = new Set(['fast_food', 'food_court', 'restaurant']);
const HOTEL_TOURISM = new Set(['apartment', 'guest_house', 'hostel', 'hotel', 'motel']);

const compactObject = (value) =>
  Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => {
      if (fieldValue == null) return false;
      if (typeof fieldValue === 'string') return fieldValue.trim().length > 0;
      return true;
    })
  );

const cleanText = (value) => {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
};

const toTitleCase = (value = '') =>
  String(value)
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const normalizeHourValue = (value) => {
  const match = cleanText(value)?.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return `${String(match[1]).padStart(2, '0')}:${match[2]}`;
};

const getSourceId = (element = {}) => {
  if (!element.type || !element.id) return null;
  return `osm:${element.type}/${element.id}`;
};

const getElementCoordinates = (element = {}) => {
  if (Number.isFinite(element.lon) && Number.isFinite(element.lat)) {
    return { lng: element.lon, lat: element.lat };
  }

  if (Number.isFinite(element.center?.lon) && Number.isFinite(element.center?.lat)) {
    return { lng: element.center.lon, lat: element.center.lat };
  }

  return null;
};

const buildAddress = (tags = {}, coordinates = null) => {
  const fullAddress = cleanText(tags['addr:full']);
  if (fullAddress) return fullAddress;

  const streetLine = [cleanText(tags['addr:housenumber']), cleanText(tags['addr:street'])]
    .filter(Boolean)
    .join(' ');

  const localityLine = [
    cleanText(tags['addr:city']),
    cleanText(tags['addr:province'] || tags['addr:state']),
    cleanText(tags['addr:postcode'])
  ]
    .filter(Boolean)
    .join(', ');

  const country = cleanText(tags['addr:country']);

  const formattedAddress = [streetLine, localityLine, country].filter(Boolean).join(', ');
  if (formattedAddress) return formattedAddress;

  const areaSummary = [
    cleanText(tags.neighbourhood),
    cleanText(tags.suburb),
    cleanText(tags.city),
    cleanText(tags['addr:city']),
    cleanText(tags['addr:province'] || tags['addr:state'])
  ].filter(Boolean);

  if (areaSummary.length > 0) {
    return `Near ${areaSummary.join(', ')}`;
  }

  if (coordinates) {
    return `Coordinates ${coordinates.lat.toFixed(5)}, ${coordinates.lng.toFixed(5)}`;
  }

  return null;
};

const extractStoreHours = (openingHours) => {
  const normalized = cleanText(openingHours);
  if (!normalized) {
    return {};
  }

  if (normalized === '24/7') {
    return {
      open: '00:00',
      close: '23:59',
      hours_display: '24/7'
    };
  }

  const firstRange = normalized.match(/(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/);
  if (!firstRange) {
    return { hours_display: normalized };
  }

  const open = normalizeHourValue(firstRange[1]);
  const close = normalizeHourValue(firstRange[2]);

  return compactObject({
    open,
    close,
    hours_display: normalized
  });
};

const buildDemoProducts = (category, tags = {}) => {
  const cuisine = cleanText(tags.cuisine)
    ?.split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map(toTitleCase)
    .join(', ');

  const catalogByCategory = {
    restaurant: [
      {
        name: cuisine ? `${cuisine} Special` : 'House Special',
        price: 14.99,
        description: 'Demo menu item generated from the store category for ordering flows.'
      },
      {
        name: 'Fresh Salad',
        price: 9.99,
        description: 'Simple fallback catalog item.'
      },
      {
        name: 'Soup of the Day',
        price: 6.99,
        description: 'Simple fallback catalog item.'
      }
    ],
    cafe: [
      {
        name: 'Coffee',
        price: 3.49,
        description: 'Demo drink item generated for cafe ordering flows.'
      },
      {
        name: 'Latte',
        price: 4.99,
        description: 'Simple fallback catalog item.'
      },
      {
        name: 'Pastry',
        price: 3.99,
        description: 'Simple fallback catalog item.'
      }
    ],
    grocery: [
      {
        name: 'Fresh Produce Box',
        price: 24.99,
        description: 'Demo grocery bundle generated for browsing flows.'
      },
      {
        name: 'Pantry Essentials',
        price: 19.99,
        description: 'Simple fallback catalog item.'
      },
      {
        name: 'Dairy Bundle',
        price: 12.99,
        description: 'Simple fallback catalog item.'
      }
    ],
    pharmacy: [
      {
        name: 'Health Essentials Pack',
        price: 18.99,
        description: 'Demo pharmacy item generated for the LocalLife store detail view.'
      },
      {
        name: 'First Aid Kit',
        price: 22.99,
        description: 'Simple fallback catalog item.'
      },
      {
        name: 'Vitamin Bundle',
        price: 16.99,
        description: 'Simple fallback catalog item.'
      }
    ],
    gym: [
      {
        name: 'Day Pass',
        price: 20.0,
        description: 'Demo fitness product generated for booking flows.'
      },
      {
        name: 'Weekly Pass',
        price: 49.99,
        description: 'Simple fallback catalog item.'
      },
      {
        name: 'Personal Training Session',
        price: 75.0,
        description: 'Simple fallback catalog item.'
      }
    ],
    hotel: [
      {
        name: 'Standard Room',
        price: 189.0,
        description: 'Demo hotel listing generated for reservations.'
      },
      {
        name: 'Deluxe Room',
        price: 249.0,
        description: 'Simple fallback catalog item.'
      },
      {
        name: 'Weekend Stay',
        price: 399.0,
        description: 'Simple fallback catalog item.'
      }
    ],
    shop: [
      {
        name: 'Featured Item',
        price: 29.99,
        description: 'Demo retail item generated for browsing flows.'
      },
      {
        name: 'Gift Option',
        price: 19.99,
        description: 'Simple fallback catalog item.'
      },
      {
        name: 'Popular Pick',
        price: 39.99,
        description: 'Simple fallback catalog item.'
      }
    ]
  };

  return catalogByCategory[category] || [];
};

const mapTagsToCategory = (tags = {}) => {
  const amenity = cleanText(tags.amenity);
  const leisure = cleanText(tags.leisure);
  const tourism = cleanText(tags.tourism);
  const shop = cleanText(tags.shop);

  if (amenity && RESTAURANT_AMENITIES.has(amenity)) return 'restaurant';
  if (amenity === 'cafe') return 'cafe';
  if (amenity === 'pharmacy') return 'pharmacy';
  if (leisure === 'fitness_centre') return 'gym';
  if (tourism && HOTEL_TOURISM.has(tourism)) return 'hotel';
  if (shop && PHARMACY_SHOPS.has(shop)) return 'pharmacy';
  if (shop && GROCERY_SHOPS.has(shop)) return 'grocery';
  if (shop) return 'shop';

  return null;
};

const shouldSkipElement = (tags = {}) => {
  const lifecycleKeys = ['abandoned', 'demolished', 'disused', 'proposed', 'razed'];
  if (lifecycleKeys.some((key) => tags[key] === 'yes')) return true;
  return cleanText(tags.shop) === 'vacant';
};

const mapElementToStore = (element = {}) => {
  const tags = element.tags || {};
  if (shouldSkipElement(tags)) return null;

  const category = mapTagsToCategory(tags);
  const coordinates = getElementCoordinates(element);
  const sourceId = getSourceId(element);
  const name = cleanText(tags.name) || cleanText(tags.brand) || cleanText(tags.operator);

  if (!category || !coordinates || !sourceId || !name) {
    return null;
  }

  const openingHours = cleanText(tags.opening_hours);
  const address = buildAddress(tags, coordinates);
  const normalizedHours = extractStoreHours(openingHours);
  const products = buildDemoProducts(category, tags);
  const attributes = compactObject({
    address,
    phone: cleanText(tags.phone) || cleanText(tags['contact:phone']),
    website: cleanText(tags.website) || cleanText(tags['contact:website']),
    opening_hours: openingHours,
    brand: cleanText(tags.brand),
    products,
    products_generated: products.length > 0,
    products_source: products.length > 0 ? 'generated_from_category' : null,
    source: 'openstreetmap',
    source_id: sourceId,
    source_type: element.type,
    source_numeric_id: element.id,
    source_url: `https://www.openstreetmap.org/${element.type}/${element.id}`,
    osm_tags: tags,
    ...normalizedHours
  });

  return {
    name,
    category,
    lat: coordinates.lat,
    lng: coordinates.lng,
    attributes
  };
};

const buildOverpassQuery = ({ south, west, north, east }) => `
[out:json][timeout:120];
(
  node["shop"](${south},${west},${north},${east});
  way["shop"](${south},${west},${north},${east});
  relation["shop"](${south},${west},${north},${east});
  node["amenity"~"restaurant|fast_food|food_court|cafe|pharmacy"](${south},${west},${north},${east});
  way["amenity"~"restaurant|fast_food|food_court|cafe|pharmacy"](${south},${west},${north},${east});
  relation["amenity"~"restaurant|fast_food|food_court|cafe|pharmacy"](${south},${west},${north},${east});
  node["leisure"="fitness_centre"](${south},${west},${north},${east});
  way["leisure"="fitness_centre"](${south},${west},${north},${east});
  relation["leisure"="fitness_centre"](${south},${west},${north},${east});
  node["tourism"="hotel"](${south},${west},${north},${east});
  way["tourism"="hotel"](${south},${west},${north},${east});
  relation["tourism"="hotel"](${south},${west},${north},${east});
);
out center tags;
`;

module.exports = {
  buildAddress,
  buildDemoProducts,
  buildOverpassQuery,
  extractStoreHours,
  getElementCoordinates,
  getSourceId,
  mapElementToStore,
  mapTagsToCategory
};
