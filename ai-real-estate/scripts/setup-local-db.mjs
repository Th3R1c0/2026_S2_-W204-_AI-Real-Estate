import { randomBytes } from "node:crypto";
import { chmod, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const envPath = ".env.local";
let envContents = "";
try {
  envContents = await readFile(envPath, "utf8");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const existingUrl = envContents.match(/^DATABASE_URL=(.+)$/m)?.[1];
const password = randomBytes(32).toString("base64url");
const mysql = "/opt/homebrew/opt/mysql@8.4/bin/mysql";
if (existingUrl) {
  const configuredDatabase = new URL(existingUrl);
  if (
    configuredDatabase.hostname !== "127.0.0.1" ||
    configuredDatabase.pathname !== "/real_estate"
  ) {
    throw new Error(
      `${envPath} already points to a different database; refusing to change it.`,
    );
  }
} else {
  const setupSql = `
CREATE DATABASE IF NOT EXISTS real_estate
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'haven_app'@'127.0.0.1' IDENTIFIED BY '${password}';
ALTER USER 'haven_app'@'127.0.0.1' IDENTIFIED BY '${password}';
GRANT ALL PRIVILEGES ON real_estate.* TO 'haven_app'@'127.0.0.1';
`;

  const mysqlResult = spawnSync(mysql, ["--protocol=socket", "--user=root"], {
    encoding: "utf8",
    input: setupSql,
  });
  if (mysqlResult.error) throw mysqlResult.error;
  if (mysqlResult.status !== 0) {
    throw new Error(
      `Could not create the local database and app user with MySQL root access.\n${mysqlResult.stderr}`,
    );
  }

  const databaseUrl = `mysql://haven_app:${password}@127.0.0.1:3306/real_estate`;
  const separator = envContents && !envContents.endsWith("\n") ? "\n" : "";
  await writeFile(envPath, `${envContents}${separator}DATABASE_URL=${databaseUrl}\n`, {
    mode: 0o600,
  });
  await chmod(envPath, 0o600);
  console.info("Created the local real_estate database and stored DATABASE_URL in .env.local.");
}

for (const script of ["db:migrate"]) {
  const result = spawnSync("npm", ["run", script], {
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`npm run ${script} failed with exit code ${result.status}.`);
  }
}

const triggerSql = `
DROP TRIGGER IF EXISTS trg_address_bi;
DROP TRIGGER IF EXISTS trg_address_bu;
CREATE TRIGGER trg_address_bi BEFORE INSERT ON address
FOR EACH ROW SET NEW.location = POINT(NEW.longitude, NEW.latitude);
CREATE TRIGGER trg_address_bu BEFORE UPDATE ON address
FOR EACH ROW SET NEW.location = POINT(NEW.longitude, NEW.latitude);
`;
const triggerResult = spawnSync(mysql, ["--protocol=socket", "--user=root", "real_estate"], {
  encoding: "utf8",
  input: triggerSql,
});
if (triggerResult.error) throw triggerResult.error;
if (triggerResult.status !== 0) {
  throw new Error(`Could not install address coordinate triggers.\n${triggerResult.stderr}`);
}

const seedResult = spawnSync("npm", ["run", "db:seed"], {
  encoding: "utf8",
  stdio: "inherit",
});
if (seedResult.error) throw seedResult.error;
if (seedResult.status !== 0) {
  throw new Error(`npm run db:seed failed with exit code ${seedResult.status}.`);
}
