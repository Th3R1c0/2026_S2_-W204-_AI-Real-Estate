import "server-only";

import { drizzle } from "drizzle-orm/mysql2";
import mysql, { type Pool } from "mysql2/promise";
import * as schema from "./schema";

type DatabaseGlobal = typeof globalThis & {
  mysqlPool?: Pool;
};

const databaseGlobal = globalThis as DatabaseGlobal;

export function getDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be set to connect to the MySQL database.");
  }

  const pool =
    databaseGlobal.mysqlPool ??
    (databaseGlobal.mysqlPool = mysql.createPool(databaseUrl));

  return drizzle(pool, { schema, mode: "default" });
}

export async function closeDb() {
  if (databaseGlobal.mysqlPool) {
    await databaseGlobal.mysqlPool.end();
    databaseGlobal.mysqlPool = undefined;
  }
}
