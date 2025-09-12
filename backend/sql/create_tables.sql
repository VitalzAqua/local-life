CREATE TABLE stores (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  location GEOGRAPHY(Point, 4326) NOT NULL,
  attributes JSONB
);
CREATE INDEX idx_stores_location ON stores USING GIST(location);
CREATE INDEX idx_stores_category ON stores(category);
