#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { db } = require('../db');
const { TORONTO_BOUNDS } = require('../config/constants');
const { buildOverpassQuery, mapElementToStore } = require('./osmStoreImportUtils');

const DEFAULT_OVERPASS_URL = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';
const INSERT_BATCH_SIZE = 100;

const parseArgs = (argv) => {
  const options = {
    dryRun: false,
    limit: null,
    overpassUrl: DEFAULT_OVERPASS_URL
  };

  argv.forEach((arg) => {
    if (arg === '--dry-run') {
      options.dryRun = true;
      return;
    }

    if (arg.startsWith('--limit=')) {
      const limit = Number.parseInt(arg.slice('--limit='.length), 10);
      if (!Number.isFinite(limit) || limit <= 0) {
        throw new Error(`Invalid --limit value: ${arg}`);
      }
      options.limit = limit;
      return;
    }

    if (arg.startsWith('--overpass-url=')) {
      options.overpassUrl = arg.slice('--overpass-url='.length);
      return;
    }

    throw new Error(`Unknown argument: ${arg}`);
  });

  return options;
};

const fetchJsonWithTimeout = async (url, body, timeoutMs) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ data: body }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Overpass request failed (${response.status}): ${errorBody.slice(0, 300)}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
};

const dedupeStores = (stores) => {
  const seen = new Set();
  const uniqueStores = [];

  stores.forEach((store) => {
    const sourceId = store.attributes?.source_id;
    if (!sourceId || seen.has(sourceId)) return;
    seen.add(sourceId);
    uniqueStores.push(store);
  });

  return uniqueStores;
};

const summarizeCategories = (stores) =>
  stores.reduce((summary, store) => {
    summary[store.category] = (summary[store.category] || 0) + 1;
    return summary;
  }, {});

const insertBatch = async (client, stores) => {
  let inserted = 0;
  let updated = 0;

  for (const store of stores) {
    const result = await client.query(
      `
        INSERT INTO stores (name, category, location, attributes)
        VALUES (
          $1,
          $2,
          ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
          $5::jsonb
        )
        ON CONFLICT ((attributes->>'source_id')) WHERE (attributes ? 'source_id')
        DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          location = EXCLUDED.location,
          attributes = EXCLUDED.attributes
        RETURNING id, xmax = 0 AS inserted
      `,
      [
        store.name,
        store.category,
        store.lng,
        store.lat,
        JSON.stringify(store.attributes)
      ]
    );

    if (result.rowCount > 0) {
      if (result.rows[0].inserted) {
        inserted += 1;
      } else {
        updated += 1;
      }
    }
  }

  return { inserted, updated };
};

const importStores = async ({ dryRun, limit, overpassUrl }) => {
  const query = buildOverpassQuery({
    south: TORONTO_BOUNDS.SOUTH,
    west: TORONTO_BOUNDS.WEST,
    north: TORONTO_BOUNDS.NORTH,
    east: TORONTO_BOUNDS.EAST
  });

  console.log(`Fetching Toronto POIs from ${overpassUrl}...`);
  const payload = await fetchJsonWithTimeout(overpassUrl, query, 120000);
  const mappedStores = (payload.elements || []).map(mapElementToStore).filter(Boolean);
  const uniqueStores = dedupeStores(mappedStores);
  const storesToImport = limit ? uniqueStores.slice(0, limit) : uniqueStores;
  const categorySummary = summarizeCategories(storesToImport);

  console.log(`Fetched ${payload.elements?.length || 0} raw OSM elements.`);
  console.log(`Mapped ${storesToImport.length} importable stores after filtering and dedupe.`);
  console.log('Category summary:', categorySummary);

  if (dryRun) {
    return { inserted: 0, skipped: storesToImport.length, total: storesToImport.length };
  }

  const client = await db.getClient();

  try {
    let inserted = 0;
    let updated = 0;

    for (let index = 0; index < storesToImport.length; index += INSERT_BATCH_SIZE) {
      const batch = storesToImport.slice(index, index + INSERT_BATCH_SIZE);
      const batchResult = await insertBatch(client, batch);
      inserted += batchResult.inserted;
      updated += batchResult.updated;
      console.log(
        `Processed ${Math.min(index + INSERT_BATCH_SIZE, storesToImport.length)} / ${storesToImport.length} stores...`
      );
    }

    return {
      inserted,
      updated,
      skipped: storesToImport.length - inserted - updated,
      total: storesToImport.length
    };
  } finally {
    client.release();
  }
};

const main = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required. The importer reads backend/.env by default.');
  }

  const options = parseArgs(process.argv.slice(2));
  const result = await importStores(options);

  console.log(
    options.dryRun
      ? `Dry run complete. ${result.total} stores are ready to import.`
      : `Import complete. Inserted ${result.inserted} stores, updated ${result.updated} stores, and skipped ${result.skipped} duplicates.`
  );
};

main()
  .catch((error) => {
    console.error('OSM import failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.end();
  });
