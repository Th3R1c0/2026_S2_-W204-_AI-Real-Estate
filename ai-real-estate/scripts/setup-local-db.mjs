import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const envPath = ".env.local";
let envContents;
try {
  envContents = await readFile(envPath, "utf8");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  throw new Error(`Create ${envPath} and set DATABASE_URL to your PostgreSQL database.`);
}

const databaseUrl = envContents.match(/^DATABASE_URL=(.+)$/m)?.[1];
if (!databaseUrl) {
  throw new Error(`Set DATABASE_URL in ${envPath} to your PostgreSQL database.`);
}

const protocol = new URL(databaseUrl).protocol;
if (protocol !== "postgres:" && protocol !== "postgresql:") {
  throw new Error(`${envPath} DATABASE_URL must use the PostgreSQL protocol.`);
}

for (const script of ["db:migrate", "db:seed"]) {
  const result = spawnSync("npm", ["run", script], {
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`npm run ${script} failed with exit code ${result.status}.`);
  }
}
