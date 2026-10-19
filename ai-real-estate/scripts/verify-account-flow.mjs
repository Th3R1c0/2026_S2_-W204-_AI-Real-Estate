import { randomBytes } from "node:crypto";
import pg from "pg";

const baseUrl = process.env.ACCOUNT_TEST_URL ?? "http://localhost:3001";
const suffix = randomBytes(6).toString("hex");
const accounts = [1, 2].map(number => ({
  username: `accounttest_${number}_${suffix}`,
  email: `accounttest_${number}_${suffix}@example.invalid`,
  password: randomBytes(24).toString("base64url"),
}));
const db = new pg.Client({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });

async function request(path, options = {}, cookie) {
  const response = await fetch(new URL(path, baseUrl), {
    ...options,
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) },
  });
  const body = await response.json();
  return { status: response.status, body, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}

function expectStatus(result, status, step) {
  if (result.status !== status) throw new Error(`${step}: expected ${status}, got ${result.status}: ${JSON.stringify(result.body)}`);
}

try {
  await db.connect();
  const first = await request("/api/auth", { method: "POST", body: JSON.stringify({ action: "register", ...accounts[0] }) });
  expectStatus(first, 201, "register first buyer");
  const second = await request("/api/auth", { method: "POST", body: JSON.stringify({ action: "register", ...accounts[1] }) });
  expectStatus(second, 201, "register second buyer");
  const duplicate = await request("/api/auth", { method: "POST", body: JSON.stringify({ action: "register", ...accounts[0] }) });
  expectStatus(duplicate, 409, "duplicate registration");
  const wrongPassword = await request("/api/auth", { method: "POST", body: JSON.stringify({ action: "login", email: accounts[0].email, password: "incorrect-password" }) });
  expectStatus(wrongPassword, 401, "wrong password");
  const initial = await request("/api/account/workspace", {}, first.cookie);
  expectStatus(initial, 200, "first workspace");
  if (initial.body.workspace.savedPropertyIds.length) throw new Error("new workspace is not empty");
  for (const [field, value] of Object.entries({
    savedPropertyIds: ["test-home"],
    generalNotes: [{ id: "note", title: "Buyer one", content: "Private", createdAt: "today" }],
    propertyNotes: { "test-home": [{ id: "property-note", propertyId: "test-home", content: "Inspect roof", createdAt: "today" }] },
    destinations: [{ id: "work", name: "Work", address: "1 Queen Street", latitude: -36.84, longitude: 174.77 }],
  })) {
    expectStatus(await request("/api/account/workspace", { method: "PATCH", body: JSON.stringify({ field, value }) }, first.cookie), 200, `save ${field}`);
  }
  const other = await request("/api/account/workspace", {}, second.cookie);
  expectStatus(other, 200, "second workspace");
  if (other.body.workspace.savedPropertyIds.length || other.body.workspace.generalNotes.length || other.body.workspace.destinations.length) {
    throw new Error("first buyer's data leaked to second buyer");
  }
  const signedInAgain = await request("/api/auth", { method: "POST", body: JSON.stringify({ action: "login", email: accounts[0].email, password: accounts[0].password }) });
  expectStatus(signedInAgain, 200, "sign in again");
  const restored = await request("/api/account/workspace", {}, signedInAgain.cookie);
  expectStatus(restored, 200, "restored workspace");
  if (restored.body.workspace.savedPropertyIds[0] !== "test-home" || restored.body.workspace.generalNotes[0]?.title !== "Buyer one" ||
    restored.body.workspace.propertyNotes["test-home"]?.[0]?.content !== "Inspect roof" || restored.body.workspace.destinations[0]?.name !== "Work") {
    throw new Error("saved buyer workspace was not restored");
  }
  expectStatus(await request("/api/auth", { method: "DELETE" }, signedInAgain.cookie), 200, "sign out");
  expectStatus(await request("/api/account/workspace", {}, signedInAgain.cookie), 401, "revoked session");
  console.log("Account flow passed: register, duplicate check, password check, isolated saved data, login restore, logout.");
} finally {
  if (db._connected) {
    await db.query("DELETE FROM users WHERE email = ANY($1)", [accounts.map(account => account.email)]);
    await db.end();
  }
}
