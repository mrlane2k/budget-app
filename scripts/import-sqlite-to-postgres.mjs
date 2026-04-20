import nextEnv from "@next/env";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import initSqlJs from "sql.js";
import { Client } from "pg";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

function shouldUseSsl(connectionString) {
  const url = new URL(connectionString);
  const sslMode = url.searchParams.get("sslmode");

  if (sslMode === "disable") {
    return false;
  }

  return !["localhost", "127.0.0.1"].includes(url.hostname);
}

function parseArgs(argv) {
  const args = { sqlitePath: "", force: false };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === "--force") {
      args.force = true;
      continue;
    }
    if (current === "--sqlite") {
      args.sqlitePath = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (!args.sqlitePath) {
      args.sqlitePath = current;
    }
  }

  return args;
}

function getRows(database, tableName) {
  const result = database.exec(`SELECT * FROM ${tableName}`);
  if (result.length === 0) {
    return [];
  }

  const [{ columns, values }] = result;
  return values.map((row) =>
    Object.fromEntries(columns.map((column, index) => [column, row[index]]))
  );
}

async function resetSequence(client, tableName) {
  await client.query(
    `
      SELECT setval(
        pg_get_serial_sequence($1, 'id'),
        COALESCE((SELECT MAX(id) FROM ${tableName}), 1),
        (SELECT COUNT(*) > 0 FROM ${tableName})
      )
    `,
    [tableName]
  );
}

async function main() {
  const { sqlitePath, force } = parseArgs(process.argv.slice(2));
  if (!sqlitePath) {
    throw new Error(
      "Usage: node scripts/import-sqlite-to-postgres.mjs --sqlite <path-to-budget.db> [--force]"
    );
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  const require = createRequire(import.meta.url);
  const wasmPath = require.resolve("sql.js/dist/sql-wasm.wasm");
  const SQL = await initSqlJs({
    locateFile: () => wasmPath,
  });

  const sqliteBytes = new Uint8Array(await fs.readFile(path.resolve(sqlitePath)));
  const sqliteDb = new SQL.Database(sqliteBytes);

  const users = getRows(sqliteDb, "users");
  const bills = getRows(sqliteDb, "bills");
  const billPayments = getRows(sqliteDb, "bill_payments");
  const cards = getRows(sqliteDb, "credit_cards");
  const cardTransactions = getRows(sqliteDb, "credit_card_transactions");

  const client = new Client({
    connectionString: databaseUrl,
    ssl: shouldUseSsl(databaseUrl)
      ? { rejectUnauthorized: false }
      : undefined,
  });

  await client.connect();

  try {
    const userCount = await client.query("SELECT COUNT(*)::int AS count FROM users");
    if ((userCount.rows[0]?.count ?? 0) > 0 && !force) {
      throw new Error(
        "Target Postgres database is not empty. Re-run with --force if you want to replace existing data."
      );
    }

    await client.query("BEGIN");

    if (force) {
      await client.query("TRUNCATE credit_card_transactions, credit_cards, bill_payments, bills, users RESTART IDENTITY CASCADE");
    }

    for (const user of users) {
      await client.query(
        `
          INSERT INTO users (
            id,
            username,
            password_hash,
            pay_cycle,
            last_paycheck_date,
            created_at,
            monthly_income,
            current_savings,
            extra_cc_payment
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          user.id,
          user.username,
          user.password_hash,
          user.pay_cycle ?? "bi-weekly",
          user.last_paycheck_date ?? null,
          user.created_at ?? null,
          user.monthly_income ?? 0,
          user.current_savings ?? 0,
          user.extra_cc_payment ?? 0,
        ]
      );
    }

    for (const bill of bills) {
      await client.query(
        `
          INSERT INTO bills (
            id,
            user_id,
            name,
            category,
            amount,
            due_day,
            due_date,
            is_autopay,
            active,
            frequency,
            created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `,
        [
          bill.id,
          bill.user_id,
          bill.name,
          bill.category ?? null,
          bill.amount,
          bill.due_day ?? 1,
          bill.due_date ?? null,
          Boolean(bill.is_autopay),
          bill.active === undefined ? true : Boolean(bill.active),
          bill.frequency ?? "monthly",
          bill.created_at ?? null,
        ]
      );
    }

    for (const payment of billPayments) {
      await client.query(
        `
          INSERT INTO bill_payments (
            id,
            bill_id,
            year,
            month,
            status,
            amount_paid,
            paid_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          payment.id,
          payment.bill_id,
          payment.year,
          payment.month,
          payment.status ?? "unpaid",
          payment.amount_paid ?? null,
          payment.paid_at ?? null,
        ]
      );
    }

    for (const card of cards) {
      await client.query(
        `
          INSERT INTO credit_cards (
            id,
            user_id,
            name,
            balance,
            credit_limit,
            minimum_payment,
            apr,
            due_day,
            last_four,
            active,
            created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `,
        [
          card.id,
          card.user_id,
          card.name,
          card.balance ?? 0,
          card.credit_limit ?? 0,
          card.minimum_payment ?? 0,
          card.apr ?? 0,
          card.due_day ?? 1,
          card.last_four ?? null,
          card.active === undefined ? true : Boolean(card.active),
          card.created_at ?? null,
        ]
      );
    }

    for (const transaction of cardTransactions) {
      await client.query(
        `
          INSERT INTO credit_card_transactions (
            id,
            card_id,
            type,
            amount,
            note,
            transaction_date,
            created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          transaction.id,
          transaction.card_id,
          transaction.type,
          transaction.amount,
          transaction.note ?? null,
          transaction.transaction_date,
          transaction.created_at ?? null,
        ]
      );
    }

    await resetSequence(client, "users");
    await resetSequence(client, "bills");
    await resetSequence(client, "bill_payments");
    await resetSequence(client, "credit_cards");
    await resetSequence(client, "credit_card_transactions");

    await client.query("COMMIT");

    console.log("SQLite import completed successfully.");
    console.log(
      `Imported ${users.length} users, ${bills.length} bills, ${billPayments.length} bill payments, ${cards.length} cards, and ${cardTransactions.length} card transactions.`
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
