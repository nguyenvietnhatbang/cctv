import "server-only";

import { Pool, type PoolClient, type QueryResultRow } from "pg";

declare global {
  var cctvPgPool: Pool | undefined;
}

function shouldUseSsl(connectionString: string) {
  return !connectionString.includes("localhost") && !connectionString.includes("127.0.0.1");
}

function readPositiveIntegerEnv(name: string, fallback: number) {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getPool() {
  if (globalThis.cctvPgPool) {
    return globalThis.cctvPgPool;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Missing DATABASE_URL");
  }

  const pool = new Pool({
    connectionString,
    max: readPositiveIntegerEnv("PG_POOL_MAX", 10),
    idleTimeoutMillis: readPositiveIntegerEnv("PG_IDLE_TIMEOUT_MS", 30_000),
    connectionTimeoutMillis: readPositiveIntegerEnv("PG_CONNECTION_TIMEOUT_MS", 15_000),
    ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  });

  pool.on("error", (err) => {
    console.error("Unexpected error on idle pg client:", err);
  });

  globalThis.cctvPgPool = pool;
  return globalThis.cctvPgPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
) {
  return getPool().query<T>(text, params);
}

export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
