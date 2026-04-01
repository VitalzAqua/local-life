-- =============================================================
-- Local Life Platform - Complete Database Schema
-- Run this once against a fresh local PostgreSQL database:
--   psql -U postgres -d local_life -f schema.sql
-- =============================================================

-- Enable PostGIS (required for geographic queries)
CREATE EXTENSION IF NOT EXISTS postgis;

-- =============================================================
-- STORES
-- =============================================================
CREATE TABLE IF NOT EXISTS stores (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  category   TEXT NOT NULL,
  location   GEOGRAPHY(Point, 4326) NOT NULL,
  attributes JSONB                       -- includes address/open/close/products
                                         -- products shape: [{name, price, description?}]
);
CREATE INDEX IF NOT EXISTS idx_stores_location ON stores USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_stores_category ON stores(category);
CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_source_id
  ON stores ((attributes->>'source_id'))
  WHERE attributes ? 'source_id';

-- =============================================================
-- USERS
-- =============================================================
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- ORDERS
-- =============================================================
CREATE TABLE IF NOT EXISTS orders (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
  store_id     INTEGER REFERENCES stores(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending',
  order_type   TEXT NOT NULL DEFAULT 'eat_in' CHECK (order_type IN ('eat_in', 'delivery')),
  total_amount DECIMAL(10,2) NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_user_id  ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_store_id ON orders(store_id);

-- =============================================================
-- ORDER ITEMS
-- =============================================================
CREATE TABLE IF NOT EXISTS order_items (
  id        SERIAL PRIMARY KEY,
  order_id  INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  quantity  INTEGER NOT NULL CHECK (quantity > 0),
  price     DECIMAL(10,2) NOT NULL,
  notes     TEXT
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- =============================================================
-- RESERVATIONS
-- =============================================================
CREATE TABLE IF NOT EXISTS reservations (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER REFERENCES users(id) ON DELETE CASCADE,
  store_id         INTEGER REFERENCES stores(id) ON DELETE CASCADE,
  reservation_date TIMESTAMPTZ NOT NULL,
  party_size       INTEGER NOT NULL CHECK (party_size > 0),
  status           TEXT NOT NULL DEFAULT 'pending',
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reservations_user_id  ON reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_reservations_store_id ON reservations(store_id);
CREATE INDEX IF NOT EXISTS idx_reservations_date     ON reservations(reservation_date);

-- =============================================================
-- SAVED LOCATIONS
-- =============================================================
CREATE TABLE IF NOT EXISTS saved_locations (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
  store_id      INTEGER REFERENCES stores(id) ON DELETE CASCADE,
  location_name TEXT NOT NULL,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT idx_unique_user_store UNIQUE (user_id, store_id)
);
CREATE INDEX IF NOT EXISTS idx_saved_locations_user ON saved_locations(user_id);

-- =============================================================
-- DRIVERS
-- Full schema required by the delivery + assignment systems.
-- car           = human-readable vehicle description (shown in UI)
-- license_plate = alias used by some queries (same value as car)
-- =============================================================
CREATE TABLE IF NOT EXISTS drivers (
  id                    SERIAL PRIMARY KEY,
  name                  TEXT NOT NULL,
  age                   INTEGER,
  car                   TEXT NOT NULL,
  license_plate         TEXT,                        -- kept in sync with car
  is_available          BOOLEAN DEFAULT TRUE,
  is_online             BOOLEAN DEFAULT TRUE,
  current_lat           DECIMAL(10,8),
  current_lng           DECIMAL(11,8),
  speed_kmh             INTEGER DEFAULT 40,
  max_concurrent_orders INTEGER DEFAULT 3,
  original_location     GEOGRAPHY(Point, 4326),      -- home/starting position
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_drivers_available ON drivers(is_available);
CREATE INDEX IF NOT EXISTS idx_drivers_online    ON drivers(is_online);

-- =============================================================
-- DELIVERIES
-- =============================================================
CREATE TABLE IF NOT EXISTS deliveries (
  id                       SERIAL PRIMARY KEY,
  order_id                 INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  driver_id                INTEGER REFERENCES drivers(id),
  status                   TEXT NOT NULL DEFAULT 'assigned'
                             CHECK (status IN (
                               'assigned','started','arrived_at_restaurant',
                               'picked_up','returning','completed','cancelled'
                             )),
  restaurant_location      JSONB,                    -- {lat, lng} of the store
  customer_location        JSONB,                    -- {address, lat, lng} from user
  estimated_delivery_time  INTEGER DEFAULT 30,       -- minutes
  route_order              INTEGER DEFAULT 1,
  assigned_at              TIMESTAMPTZ DEFAULT NOW(),
  started_at               TIMESTAMPTZ,
  arrived_at_restaurant_at TIMESTAMPTZ,
  picked_up_at             TIMESTAMPTZ,
  delivered_at             TIMESTAMPTZ,
  completed_at             TIMESTAMPTZ,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deliveries_order_id    ON deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_driver_id   ON deliveries(driver_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status      ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_driver_route
  ON deliveries(driver_id, route_order)
  WHERE status NOT IN ('completed','cancelled');

-- =============================================================
-- SAMPLE DRIVERS  (Toronto area starting positions)
-- =============================================================
INSERT INTO drivers (name, age, car, license_plate, is_available, is_online,
                     current_lat, current_lng, speed_kmh, max_concurrent_orders,
                     original_location)
VALUES
  ('John Smith',    28, 'Honda Civic',     'ABCD 001', TRUE, TRUE,
   43.6532, -79.3832, 40, 3,
   ST_SetSRID(ST_MakePoint(-79.3832, 43.6532), 4326)::geography),

  ('Sarah Johnson', 32, 'Toyota Corolla',  'ABCD 002', TRUE, TRUE,
   43.6610, -79.3957, 40, 3,
   ST_SetSRID(ST_MakePoint(-79.3957, 43.6610), 4326)::geography),

  ('Mike Chen',     25, 'Nissan Sentra',   'ABCD 003', TRUE, TRUE,
   43.6480, -79.3960, 40, 3,
   ST_SetSRID(ST_MakePoint(-79.3960, 43.6480), 4326)::geography),

  ('Emily Davis',   29, 'Ford Focus',      'ABCD 004', TRUE, TRUE,
   43.6700, -79.3800, 40, 3,
   ST_SetSRID(ST_MakePoint(-79.3800, 43.6700), 4326)::geography),

  ('Alex Brown',    31, 'Mazda 3',         'ABCD 005', TRUE, TRUE,
   43.6550, -79.4100, 40, 3,
   ST_SetSRID(ST_MakePoint(-79.4100, 43.6550), 4326)::geography)
ON CONFLICT DO NOTHING;
