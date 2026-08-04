import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

// Next dev + HMR re-evaluates modules on every edit; without the global cache
// each reload would open another connection pool until the database refuses
// them. Supabase's pooler has a much lower ceiling than a local server, so this
// matters more now than it did on SQLite.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Supabase's session pooler hands out a *server* connection per client
 * connection and a free project gets very few of them. node-postgres defaults
 * to a pool of 10, which one dev server is enough to exhaust — after which
 * every query fails with a bare `ETIMEDOUT` that looks like the database is
 * down rather than like the app is holding it hostage.
 */
/**
 * Two in development, because the dev server is never the only thing holding
 * connections — the seed, the importer and any one-off script all want one at
 * the same time, and a saturated pooler fails as a bare `ETIMEDOUT` that reads
 * like the database is down. Production gets a real pool.
 */
const POOL_MAX = process.env.NODE_ENV === "production" ? 8 : 2;

function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set — copy .env.example to .env");
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: url,
      max: POOL_MAX,
      // Opening a connection to a hosted database is TCP, then TLS, then auth —
      // measured at ~800ms from here. At the previous 10s this pool dropped its
      // connections faster than an athlete reads a screen, so a click after any
      // real pause paid that reconnect before its first query. What protects
      // the pooler is POOL_MAX above, which caps how many we can ever hold;
      // letting those few stay warm costs the pooler nothing extra.
      idleTimeoutMillis: 5 * 60_000,
      connectionTimeoutMillis: 15_000,
    }),
  });
}

export const db: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
