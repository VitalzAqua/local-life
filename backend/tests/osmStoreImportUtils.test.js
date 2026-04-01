const {
  buildAddress,
  buildDemoProducts,
  buildOverpassQuery,
  extractStoreHours,
  mapElementToStore,
  mapTagsToCategory
} = require('../scripts/osmStoreImportUtils');

describe('OSM store import utilities', () => {
  test('maps common OSM tags into LocalLife store categories', () => {
    expect(mapTagsToCategory({ amenity: 'restaurant' })).toBe('restaurant');
    expect(mapTagsToCategory({ amenity: 'cafe' })).toBe('cafe');
    expect(mapTagsToCategory({ amenity: 'pharmacy' })).toBe('pharmacy');
    expect(mapTagsToCategory({ leisure: 'fitness_centre' })).toBe('gym');
    expect(mapTagsToCategory({ tourism: 'hotel' })).toBe('hotel');
    expect(mapTagsToCategory({ shop: 'supermarket' })).toBe('grocery');
    expect(mapTagsToCategory({ shop: 'chemist' })).toBe('pharmacy');
    expect(mapTagsToCategory({ shop: 'clothes' })).toBe('shop');
  });

  test('builds a readable address from OSM address tags', () => {
    expect(
      buildAddress({
        'addr:housenumber': '123',
        'addr:street': 'Queen St W',
        'addr:city': 'Toronto',
        'addr:province': 'ON',
        'addr:postcode': 'M5H 2M9'
      })
    ).toBe('123 Queen St W, Toronto, ON, M5H 2M9');
  });

  test('falls back to area details or coordinates when a full address is missing', () => {
    expect(
      buildAddress(
        {
          neighbourhood: 'Kensington Market',
          city: 'Toronto'
        },
        { lat: 43.6541, lng: -79.4003 }
      )
    ).toBe('Near Kensington Market, Toronto');

    expect(buildAddress({}, { lat: 43.6532, lng: -79.3832 })).toBe('Coordinates 43.65320, -79.38320');
  });

  test('extracts simple open and close times from opening_hours', () => {
    expect(extractStoreHours('Mo-Su 09:00-21:00')).toEqual({
      open: '09:00',
      close: '21:00',
      hours_display: 'Mo-Su 09:00-21:00'
    });

    expect(extractStoreHours('24/7')).toEqual({
      open: '00:00',
      close: '23:59',
      hours_display: '24/7'
    });
  });

  test('builds a small demo catalog by category', () => {
    const products = buildDemoProducts('restaurant', { cuisine: 'thai' });

    expect(products).toHaveLength(3);
    expect(products[0]).toMatchObject({
      name: 'Thai Special'
    });
  });

  test('maps an overpass element into a store payload with OSM metadata', () => {
    const store = mapElementToStore({
      type: 'node',
      id: 123,
      lat: 43.6532,
      lon: -79.3832,
      tags: {
        name: 'Sample Cafe',
        amenity: 'cafe',
        opening_hours: 'Mo-Su 07:00-19:00',
        phone: '+1-416-555-0100',
        website: 'https://example.com',
        'addr:housenumber': '100',
        'addr:street': 'King St W',
        'addr:city': 'Toronto',
        'addr:province': 'ON',
        'addr:postcode': 'M5X 1A9'
      }
    });

    expect(store).toEqual({
      name: 'Sample Cafe',
      category: 'cafe',
      lat: 43.6532,
      lng: -79.3832,
      attributes: {
        address: '100 King St W, Toronto, ON, M5X 1A9',
        phone: '+1-416-555-0100',
        website: 'https://example.com',
        opening_hours: 'Mo-Su 07:00-19:00',
        open: '07:00',
        close: '19:00',
        hours_display: 'Mo-Su 07:00-19:00',
        products: [
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
        products_generated: true,
        products_source: 'generated_from_category',
        source: 'openstreetmap',
        source_id: 'osm:node/123',
        source_type: 'node',
        source_numeric_id: 123,
        source_url: 'https://www.openstreetmap.org/node/123',
        osm_tags: {
          name: 'Sample Cafe',
          amenity: 'cafe',
          opening_hours: 'Mo-Su 07:00-19:00',
          phone: '+1-416-555-0100',
          website: 'https://example.com',
          'addr:housenumber': '100',
          'addr:street': 'King St W',
          'addr:city': 'Toronto',
          'addr:province': 'ON',
          'addr:postcode': 'M5X 1A9'
        }
      }
    });
  });

  test('builds an overpass query for the supplied bounds', () => {
    const query = buildOverpassQuery({
      south: 43.58,
      west: -79.64,
      north: 43.85,
      east: -79.11
    });

    expect(query).toContain('node["shop"](43.58,-79.64,43.85,-79.11);');
    expect(query).toContain('node["tourism"="hotel"](43.58,-79.64,43.85,-79.11);');
    expect(query).toContain('out center tags;');
  });
});
