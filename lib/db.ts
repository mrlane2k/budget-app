import { Pool, type PoolClient, type QueryResult, type QueryResultRow, types } from "pg";
import { getDatabaseUrl } from "@/lib/config";

types.setTypeParser(20, (value) => Number(value));
types.setTypeParser(1700, (value) => Number(value));

let pool: Pool | undefined;

function shouldUseSsl(connectionString: string): boolean {
  const url = new URL(connectionString);
  const sslMode = url.searchParams.get("sslmode");

  if (sslMode === "disable") {
    return false;
  }

  return !["localhost", "127.0.0.1"].includes(url.hostname);
}

export function getPool(): Pool {
  if (!pool) {
    const connectionString = getDatabaseUrl();
    pool = new Pool({
      connectionString,
      ssl: shouldUseSsl(connectionString)
        ? { rejectUnauthorized: false }
        : undefined,
    });
  }

  return pool;
}

export type Queryable = {
  query<T extends QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>>;
};

export async function query<T extends QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params);
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
