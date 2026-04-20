import nextEnv from "@next/env";
import fs from "node:fs/promises";
import path from "node:path";
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

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: shouldUseSsl(databaseUrl)
      ? { rejectUnauthorized: false }
      : undefined,
  });

  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const migrationsDir = path.join(process.cwd(), "db", "migrations");
    const files = (await fs.readdir(migrationsDir))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const existing = await client.query(
        "SELECT 1 FROM schema_migrations WHERE id = $1",
        [file]
      );

      if (existing.rowCount) {
        console.log(`Skipping ${file}`);
        continue;
      }

      const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");

      console.log(`Applying ${file}`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (id) VALUES ($1)",
          [file]
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
