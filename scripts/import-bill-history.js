#!/usr/bin/env node
/**
 * Import bill history from CSV and update bill amounts to rolling 12-month average.
 * Usage: node scripts/import-bill-history.js bill-history-template.csv
 * 
 * Only updates bills where variable amounts were entered.
 * Bills with all blanks are left unchanged.
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('Usage: node scripts/import-bill-history.js <csv-file>');
  process.exit(1);
}

const csv = fs.readFileSync(csvPath, 'utf8');
const lines = csv.trim().split('\n');
const headers = lines[0].split(',');

// Month columns: jan_2025 through dec_2025
const monthCols = headers.slice(3, 15);

const db = new Database(path.join(__dirname, '..', 'budget.db'));

let updated = 0;
let skipped = 0;

for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim() || line.startsWith('//')) continue;

  const cols = line.split(',');
  const billName = cols[0]?.trim();
  if (!billName) continue;

  // Get all non-empty month values
  const amounts = [];
  for (let m = 0; m < 12; m++) {
    const val = cols[3 + m]?.trim();
    if (val && !isNaN(parseFloat(val))) {
      amounts.push(parseFloat(val));
    }
  }

  if (amounts.length === 0) {
    console.log(`⏭  ${billName} — no history entered, skipping`);
    skipped++;
    continue;
  }

  // Calculate rolling average
  const avg = amounts.reduce((s, v) => s + v, 0) / amounts.length;
  const rounded = Math.round(avg * 100) / 100;

  // Update the bill
  const result = db.prepare('UPDATE bills SET amount = ? WHERE name = ? AND active = 1').run(rounded, billName);
  if (result.changes > 0) {
    console.log(`✅ ${billName} — ${amounts.length} months of data, avg: $${rounded} (was updated)`);
    updated++;
  } else {
    console.log(`⚠️  ${billName} — not found in DB or inactive`);
  }
}

db.close();
console.log(`\nDone: ${updated} updated, ${skipped} skipped (no data)`);
