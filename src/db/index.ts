import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

/** True when DATABASE_URL is present in the environment. */
export const databaseConfigured = Boolean(databaseUrl);

function buildConnectionString(url: string): string {
  let out = url;
  // Supabase transaction pooler (port 6543) requires pgbouncer=true, otherwise
  // prepared statements (used by node-postgres/drizzle) fail at runtime.
  if (out.includes("pooler.supabase") && out.includes(":6543") && !out.includes("pgbouncer")) {
    out += out.includes("?") ? "&pgbouncer=true" : "?pgbouncer=true";
  }
  return out;
}

function buildSslOptions(url: string) {
  // Supabase endpoints require TLS. If the connection string does not carry an
  // explicit sslmode, enable SSL so node-postgres does not attempt a plain
  // connection (which Supabase rejects with a pg_hba.conf error).
  const isSupabase = /supabase\.(co|com|in)/i.test(url);
  if (isSupabase && !url.includes("sslmode=")) {
    return { rejectUnauthorized: false };
  }
  if (process.env.PGSSL === "true") {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

function createPool(): Pool {
  if (!databaseUrl) {
    // Do NOT throw at module load — that would kill the whole server process
    // (and show a generic host error page). Instead return a pool that fails
    // per-query with a clear, actionable message, keeping /api/health and the
    // server logs able to explain the misconfiguration.
    console.error(
      "[db] DATABASE_URL is NOT set. The server will start, but every database query will fail. " +
        "Add DATABASE_URL (Supabase session-pooler string) in your host environment variables."
    );
    return new Pool({
      connectionString: "postgres://missing:missing@127.0.0.1:5432/missing_database_url",
      connectionTimeoutMillis: 4000,
    });
  }

  return new Pool({
    connectionString: buildConnectionString(databaseUrl),
    ssl: buildSslOptions(databaseUrl),
    connectionTimeoutMillis: 10000,
    max: 10,
  });
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool = globalForDb.__arenaNextJsPostgresqlPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);

/** Lightweight connectivity probe used by /api/health and instrumentation. */
export async function probeDatabase(): Promise<{ ok: boolean; detail: string }> {
  if (!databaseConfigured) {
    return {
      ok: false,
      detail: "DATABASE_URL is not set in the environment variables.",
    };
  }
  try {
    await pool.query("select 1");
    return { ok: true, detail: "connected" };
  } catch (err: any) {
    return { ok: false, detail: err?.message || String(err) };
  }
}
