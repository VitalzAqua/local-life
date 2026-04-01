#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { db } = require('../db');
const {
  buildAddress,
  buildDemoProducts,
  extractStoreHours
} = require('./osmStoreImportUtils');

const BATCH_SIZE = 250;

const main = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required. The backfill reads backend/.env by default.');
  }

  const result = await db.query(`
    SELECT
      id,
      name,
      category,
      attributes,
      ST_Y(location::geometry) AS lat,
      ST_X(location::geometry) AS lng
    FROM stores
    WHERE attributes->>'source' = 'openstreetmap'
    ORDER BY id
  `);

  console.log(`Found ${result.rows.length} OpenStreetMap stores to backfill.`);

  let updated = 0;
  const client = await db.getClient();

  try {
    for (let index = 0; index < result.rows.length; index += BATCH_SIZE) {
      const batch = result.rows.slice(index, index + BATCH_SIZE);

      for (const row of batch) {
        const attributes = row.attributes || {};
        const tags = attributes.osm_tags || {};
        const coordinates = {
          lat: Number.parseFloat(row.lat),
          lng: Number.parseFloat(row.lng)
        };
        const generatedProducts = buildDemoProducts(row.category, tags);
        const existingProducts = Array.isArray(attributes.products) ? attributes.products : [];
        const nextAttributes = {
          ...attributes,
          address: attributes.address || buildAddress(tags, coordinates),
          opening_hours: attributes.opening_hours || tags.opening_hours || null,
          ...extractStoreHours(attributes.opening_hours || tags.opening_hours),
          products: existingProducts.length > 0 ? existingProducts : generatedProducts,
          products_generated:
            typeof attributes.products_generated === 'boolean'
              ? attributes.products_generated
              : generatedProducts.length > 0,
          products_source:
            attributes.products_source || (generatedProducts.length > 0 ? 'generated_from_category' : null)
        };

        await client.query(
          `UPDATE stores SET attributes = $2::jsonb WHERE id = $1`,
          [row.id, JSON.stringify(nextAttributes)]
        );

        updated += 1;
      }

      console.log(`Backfilled ${Math.min(index + BATCH_SIZE, result.rows.length)} / ${result.rows.length} stores...`);
    }
  } finally {
    client.release();
  }

  console.log(`Backfill complete. Updated ${updated} OpenStreetMap stores.`);
};

main()
  .catch((error) => {
    console.error('OSM store backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.end();
  });
