import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

type DatabaseGlobal = typeof globalThis & {
  postgresPool?: Pool;
};

const databaseGlobal = globalThis as DatabaseGlobal;

export function getDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be set to connect to the PostgreSQL database.");
  }

  const pool =
    databaseGlobal.postgresPool ??
    (databaseGlobal.postgresPool = new Pool({ connectionString: databaseUrl }));

  return drizzle(pool, { schema });
}

export async function closeDb() {
  if (databaseGlobal.postgresPool) {
    await databaseGlobal.postgresPool.end();
    databaseGlobal.postgresPool = undefined;
  }
}
