-- Saved locations table for users to save their favorite places
CREATE TABLE saved_locations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
    location_name TEXT NOT NULL, -- Custom name given by user
    notes TEXT, -- Optional notes about the location
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_saved_locations_user_id ON saved_locations(user_id);
CREATE INDEX idx_saved_locations_store_id ON saved_locations(store_id);

-- Ensure unique user-store combinations (user can't save the same location twice)
CREATE UNIQUE INDEX idx_unique_user_store ON saved_locations(user_id, store_id); 