#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Import bill history from CSV and update bill amounts to a rolling average.
 * Usage: node scripts/import-bill-history.js bill-history-template.csv
 */

const fs = require('fs');
const { Client } = require('pg');
const { loadEnvConfig } = require('@next/env');

loadEnvConfig(process.cwd());

function shouldUseSsl(connectionString) {
  const url = new URL(connectionString);
  const sslMode = url.searchParams.get('sslmode');

  if (sslMode === 'disable') {
    return false;
  }

  return !['localhost', '127.0.0.1'].includes(url.hostname);
}

(async () => {
  const csvPath = process.argv[2];
  const databaseUrl = process.env.DATABASE_URL;

  if (!csvPath) {
    console.error('Usage: node scripts/import-bill-history.js <csv-file>');
    process.exit(1);
  }

  if (!databaseUrl) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const csv = fs.readFileSync(csvPath, 'utf8');
  const lines = csv.trim().split('\n');
  const client = new Client({
    connectionString: databaseUrl,
    ssl: shouldUseSsl(databaseUrl) ? { rejectUnauthorized: false } : undefined,
  });

  await client.connect();

  let updated = 0;
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.startsWith('//')) continue;

    const cols = line.split(',');
    const billName = cols[0]?.trim();
    if (!billName) continue;

    const amounts = [];
    for (let month = 0; month < 12; month++) {
      const value = cols[3 + month]?.trim();
      if (value && !Number.isNaN(Number.parseFloat(value))) {
        amounts.push(Number.parseFloat(value));
      }
    }

    if (amounts.length === 0) {
      console.log(`SKIP ${billName}: no history entered`);
      skipped++;
      continue;
    }

    const average =
      amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
    const roundedAverage = Math.round(average * 100) / 100;

    const result = await client.query(
      'UPDATE bills SET amount = $1 WHERE name = $2 AND active = TRUE',
      [roundedAverage, billName]
    );

    if ((result.rowCount ?? 0) > 0) {
      console.log(
        `UPDATED ${billName}: ${amounts.length} months of data, average $${roundedAverage}`
      );
      updated++;
    } else {
      console.log(`WARN ${billName}: bill not found or inactive`);
    }
  }

  await client.end();
  console.log(`Done: ${updated} updated, ${skipped} skipped`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

