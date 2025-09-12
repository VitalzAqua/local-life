import random
import json

# Toronto downtown core boundaries (adjusted to stay clear of water)
BOUNDS = {
    'north': 43.700,  # Bloor St
    'south': 43.642,  # Adjusted north to Front St/Rail corridor (was 43.630)
    'west': -79.420,  # Dufferin St
    'east': -79.340   # Church/Parliament area
}

# Water boundary checks - stores must be north of these latitudes at given longitudes
WATER_BOUNDS = [
    (-79.420, 43.632),  # West end
    (-79.400, 43.636),  # Bathurst
    (-79.380, 43.640),  # Spadina
    (-79.370, 43.641),  # University
    (-79.360, 43.642),  # Yonge
    (-79.340, 43.644),  # East end
]

# Major streets for general area guidance (not strict placement)
MAJOR_STREETS = {
    'north_south': [
        -79.410,  # Dufferin
        -79.400,  # Ossington
        -79.390,  # Bathurst
        -79.380,  # Spadina
        -79.370,  # University
        -79.350,  # Yonge
        -79.340,  # Church/Parliament
    ],
    'east_west': [
        43.645,  # King
        43.650,  # Queen
        43.655,  # Dundas
        43.660,  # College
        43.665,  # Wellesley
        43.670,  # Bloor
    ]
}

# Store categories and their properties
STORE_TYPES = {
    'restaurant': {
        'names': ['A&W', 'McDonalds', 'Subway', 'Tim Hortons', 'Pizza Pizza', 'Burger King', 'KFC', 'Swiss Chalet', 'Harveys', 'Boston Pizza'],
        'products': {
            'Burger King': [
                {"name": "Whopper", "price": 8.99},
                {"name": "Chicken Royale", "price": 7.99},
                {"name": "Fries", "price": 3.99},
                {"name": "Veggie Burger", "price": 6.99}
            ],
            'Swiss Chalet': [
                {"name": "Quarter Chicken Dinner", "price": 15.99},
                {"name": "Rotisserie Chicken Sandwich", "price": 12.99},
                {"name": "Chicken Wings", "price": 14.99},
                {"name": "Garden Salad", "price": 8.99}
            ],
            'Boston Pizza': [
                {"name": "Pepperoni Pizza", "price": 16.99},
                {"name": "Spaghetti & Meatballs", "price": 15.99},
                {"name": "Caesar Salad", "price": 9.99},
                {"name": "Chicken Wings", "price": 13.99}
            ],
            'Pizza Pizza': [
                {"name": "Large Pepperoni Pizza", "price": 14.99},
                {"name": "Chicken Wings", "price": 12.99},
                {"name": "Garlic Bread", "price": 4.99},
                {"name": "Caesar Salad", "price": 8.99}
            ],
            'Subway': [
                {"name": "Italian BMT", "price": 8.99},
                {"name": "Veggie Delite", "price": 6.99},
                {"name": "Chicken Teriyaki", "price": 9.99},
                {"name": "Cookies", "price": 1.99}
            ],
            'default': [
                {"name": "House Special", "price": 12.99},
                {"name": "Salad", "price": 8.99},
                {"name": "Sandwich", "price": 9.99},
                {"name": "Soup", "price": 5.99}
            ]
        }
    },
    'cafe': {
        'names': ['Starbucks', 'Tim Hortons', 'Second Cup', 'Balzacs Coffee', 'Timothys World Coffee', 'Blenz Coffee'],
        'products': {
            'Starbucks': [
                {"name": "Caffe Latte", "price": 4.99},
                {"name": "Cappuccino", "price": 4.99},
                {"name": "Croissant", "price": 3.99},
                {"name": "Muffin", "price": 2.99}
            ],
            'default': [
                {"name": "Coffee", "price": 2.99},
                {"name": "Tea", "price": 2.49},
                {"name": "Pastry", "price": 3.99},
                {"name": "Sandwich", "price": 6.99}
            ]
        }
    },
    'grocery': {
        'names': ['Loblaws', 'Metro', 'No Frills', 'Sobeys', 'Farm Boy', 'FreshCo', 'Whole Foods', 'T&T Supermarket'],
        'products': [
            {"name": "Fresh Produce Box", "price": 25.99},
            {"name": "Meat Package", "price": 35.99},
            {"name": "Dairy Bundle", "price": 15.99},
            {"name": "Pantry Essentials", "price": 29.99}
        ]
    },
    'pharmacy': {
        'names': ['Shoppers Drug Mart', 'Rexall', 'Guardian Pharmacy', 'PharmaChoice', 'IDA Pharmacy'],
        'products': [
            {"name": "Health Consultation", "price": 50.00},
            {"name": "Flu Shot", "price": 25.00},
            {"name": "Basic Health Check", "price": 30.00},
            {"name": "Prescription Review", "price": 20.00}
        ]
    },
    'gym': {
        'names': ['GoodLife Fitness', 'LA Fitness', 'Planet Fitness', 'Anytime Fitness', 'Orangetheory Fitness'],
        'products': [
            {"name": "Day Pass", "price": 20.00},
            {"name": "Weekly Pass", "price": 50.00},
            {"name": "Monthly Membership", "price": 99.99},
            {"name": "Personal Training Session", "price": 75.00}
        ]
    }
}

# Street configuration for address generation
STREETS = {
    'south': {  # 43.642 - 43.645
        'streets': [
            ('Front Street', (1, 500)),
            ('Wellington Street', (1, 500)),
            ('King Street', (1, 500))
        ],
        'max_lat': 43.645
    },
    'mid_south': {  # 43.645 - 43.655
        'streets': [
            ('Queen Street', (1, 500)),
            ('Richmond Street', (1, 500)),
            ('Adelaide Street', (1, 500))
        ],
        'max_lat': 43.655
    },
    'mid': {  # 43.655 - 43.665
        'streets': [
            ('Dundas Street', (1, 500)),
            ('College Street', (1, 500)),
            ('Carlton Street', (1, 500))
        ],
        'max_lat': 43.665
    },
    'mid_north': {  # 43.665 - 43.675
        'streets': [
            ('Wellesley Street', (1, 500)),
            ('Harbord Street', (1, 500)),
            ('Sussex Avenue', (1, 500))
        ],
        'max_lat': 43.675
    },
    'north': {  # 43.675+
        'streets': [
            ('Bloor Street', (1, 500)),
            ('Prince Arthur Avenue', (1, 500)),
            ('Lowther Avenue', (1, 500))
        ],
        'max_lat': 43.700
    }
}

def is_in_water(lng, lat):
    """Check if a location is in the water by interpolating the water boundary."""
    # Find the two boundary points that this longitude falls between
    for i in range(len(WATER_BOUNDS) - 1):
        if WATER_BOUNDS[i][0] >= lng >= WATER_BOUNDS[i + 1][0]:
            # Interpolate the minimum latitude at this longitude
            lng1, lat1 = WATER_BOUNDS[i]
            lng2, lat2 = WATER_BOUNDS[i + 1]
            ratio = (lng - lng1) / (lng2 - lng1)
            min_lat = lat1 + ratio * (lat2 - lat1)
            return lat < min_lat
    return False

def generate_store_location():
    # Instead of picking from major streets, generate more random coordinates
    # but use the streets as a general guide for higher probability
    
    max_attempts = 50  # Prevent infinite loops
    attempts = 0
    
    while attempts < max_attempts:
        if random.random() < 0.3:  # 30% chance of completely random location
            # Generate completely random location within bounds
            lng = random.uniform(BOUNDS['west'], BOUNDS['east'])
            lat = random.uniform(BOUNDS['south'], BOUNDS['north'])
        else:
            # Generate location near (but not exactly on) major streets
            if random.random() < 0.5:
                # Pick a random north-south street as a reference
                ns_street = random.choice(MAJOR_STREETS['north_south'])
                # Add larger random offset (up to about 2-3 blocks)
                lng = ns_street + random.uniform(-0.004, 0.004)
                # Random latitude
                lat = random.uniform(BOUNDS['south'], BOUNDS['north'])
            else:
                # Pick a random east-west street as a reference
                ew_street = random.choice(MAJOR_STREETS['east_west'])
                # Random longitude
                lng = random.uniform(BOUNDS['west'], BOUNDS['east'])
                # Add larger random offset (up to about 2-3 blocks)
                lat = ew_street + random.uniform(-0.004, 0.004)
        
        # Ensure within bounds
        lng = max(min(lng, BOUNDS['east']), BOUNDS['west'])
        lat = max(min(lat, BOUNDS['north']), BOUNDS['south'])
        
        # Check if location is in water
        if not is_in_water(lng, lat):
            return (lng, lat)
        
        attempts += 1
    
    # If we couldn't find a valid location after max attempts,
    # return a safe location near Queen Street
    return (random.uniform(BOUNDS['west'], BOUNDS['east']), 43.650)

def get_street_name(lat, lng):
    """Get street name based on latitude and longitude."""
    # East-West streets based on latitude
    if lat < 43.645:
        base_streets = ['Front Street', 'Wellington Street', 'King Street']
    elif lat < 43.655:
        base_streets = ['Queen Street', 'Richmond Street', 'Adelaide Street']
    elif lat < 43.665:
        base_streets = ['Dundas Street', 'College Street', 'Carlton Street']
    elif lat < 43.675:
        base_streets = ['Wellesley Street', 'Harbord Street', 'Sussex Avenue']
    else:
        base_streets = ['Bloor Street', 'Prince Arthur Avenue', 'Lowther Avenue']

    # Add direction based on longitude
    if lng < -79.383:  # West of University Ave
        direction = 'West'
    else:
        direction = 'East'
    
    street = random.choice(base_streets)
    return f"{street} {direction}"

def get_products_for_store(category, name):
    """Get products for a specific store."""
    store_type = STORE_TYPES[category]
    if isinstance(store_type['products'], dict):
        return store_type['products'].get(name, store_type['products']['default'])
    return store_type['products']

def generate_address_pools():
    """Pre-generate pools of available addresses for each zone."""
    address_pools = {}
    
    for zone, config in STREETS.items():
        zone_addresses = set()
        for street, (start, end) in config['streets']:
            # Generate both East and West addresses
            for direction in ['East', 'West']:
                for num in range(start, end + 1, 2):  # Only even numbers for more realistic addresses
                    zone_addresses.add(f"{num} {street} {direction}")
        address_pools[zone] = zone_addresses
    
    return address_pools

def get_zone_for_latitude(lat):
    """Get the appropriate zone for a given latitude."""
    for zone, config in STREETS.items():
        if lat <= config['max_lat']:
            return zone
    return 'north'  # Default to north if above all thresholds

def get_unique_address(lat, lng, address_pools):
    """Get a unique address from the appropriate pool based on location."""
    zone = get_zone_for_latitude(lat)
    zone_pool = address_pools[zone]
    
    if not zone_pool:
        return None  # No addresses available in this zone
        
    # Select address based on longitude to maintain geographical accuracy
    is_west = lng < -79.383  # University Ave
    matching_addresses = [addr for addr in zone_pool if 
                        ('West' in addr if is_west else 'East' in addr)]
    
    if not matching_addresses:
        return None
        
    # Pick a random address from the matching ones
    address = random.choice(list(matching_addresses))
    # Remove the selected address from the pool
    zone_pool.remove(address)
    return address

def generate_sql():
    sql_lines = []
    used_locations = set()
    
    # Pre-generate pools of available addresses
    address_pools = generate_address_pools()
    
    # Generate 1000 stores
    stores_generated = 0
    max_attempts = 5000  # Prevent infinite loops
    attempts = 0
    
    while stores_generated < 1000 and attempts < max_attempts:
        # Pick random category and name
        category = random.choice(list(STORE_TYPES.keys()))
        name = random.choice(STORE_TYPES[category]['names'])
        
        # Generate unique location
        location = None
        while True:
            loc = generate_store_location()
            # Use less precise location key to allow more density variation
            loc_key = f"{loc[0]:.4f},{loc[1]:.4f}"
            if loc_key not in used_locations:
                location = loc
                used_locations.add(loc_key)
                break
        
        # Get unique address from the pre-generated pool
        address = get_unique_address(location[1], location[0], address_pools)
        
        # If we couldn't get a unique address, skip this store
        if not address:
            attempts += 1
            continue
        
        # Get products for this store
        products = get_products_for_store(category, name)
        
        # Generate store attributes
        attributes = {
            'products': products,
            'open': f"{random.randint(6,10):02d}:00",
            'close': f"{random.randint(20,23):02d}:00",
            'address': address
        }
        
        # Create SQL insert statement
        sql = f"""INSERT INTO stores (name, category, location, attributes) VALUES (
            '{name}',
            '{category}',
            ST_SetSRID(ST_MakePoint({location[0]}, {location[1]}), 4326)::geography,
            '{json.dumps(attributes)}'::jsonb
        );"""
        
        sql_lines.append(sql)
        stores_generated += 1
        attempts += 1
    
    if stores_generated < 1000:
        print(f"Warning: Only generated {stores_generated} stores due to address constraints")
    
    return sql_lines

def main():
    sql_lines = generate_sql()
    
    with open('sql/1000_stores.sql', 'w') as f:
        f.write('-- Generated store locations for Toronto downtown core\n')
        f.write('-- Coordinates are randomized with natural distribution\n\n')
        f.write('\n'.join(sql_lines))

if __name__ == '__main__':
    main() 