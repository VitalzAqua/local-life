-- Update drivers with their original locations (hard-coded starting positions)
UPDATE drivers SET original_location = ST_SetSRID(ST_MakePoint(-79.3832, 43.6532), 4326) WHERE name = 'Alex Thompson';   -- Downtown Toronto
UPDATE drivers SET original_location = ST_SetSRID(ST_MakePoint(-79.3871, 43.6426), 4326) WHERE name = 'Sarah Chen';      -- Scarborough
UPDATE drivers SET original_location = ST_SetSRID(ST_MakePoint(-79.3957, 43.6629), 4326) WHERE name = 'Mike Rodriguez';  -- North York
UPDATE drivers SET original_location = ST_SetSRID(ST_MakePoint(-79.3762, 43.6481), 4326) WHERE name = 'Emma Wilson';     -- Etobicoke
UPDATE drivers SET original_location = ST_SetSRID(ST_MakePoint(-79.3990, 43.6565), 4326) WHERE name = 'David Kim';       -- Mississauga 