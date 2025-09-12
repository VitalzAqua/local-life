-- Add original location tracking to drivers table using PostGIS
ALTER TABLE drivers ADD COLUMN original_location GEOMETRY(POINT, 4326);

-- Update existing drivers to set their current location as original location
UPDATE drivers SET original_location = ST_SetSRID(ST_MakePoint(current_lng, current_lat), 4326); 