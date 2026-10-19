import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "../db";
import { buyerWorkspaces, userSessions, users } from "../db/schema";
import { hashPassword, validateRegistration, verifyPassword } from "./auth";
import { emptyWorkspace, type BuyerWorkspace, type WorkspaceField } from "./workspace";

const cookieName = "haven_session";
const sessionSeconds = 30 * 24 * 60 * 60;
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export type AccountUser = { userId: number; username: string; email: string };

export async function registerAccount(input: unknown): Promise<{ user: AccountUser; token: string } | { error: string; status: number }> {
  const validated = validateRegistration(input);
  if ("error" in validated) return { error: validated.error, status: 400 };
  const db = getDb();
  try {
    const [created] = await db.insert(users).values({
      username: validated.username,
      email: validated.email,
      passwordHash: await hashPassword(validated.password),
    }).returning({ userId: users.userId, username: users.username, email: users.email });
    const token = await createSession(created.userId);
    return { user: created, token };
  } catch (cause) {
    const databaseError = cause && typeof cause === "object" && "cause" in cause ? cause.cause : cause;
    if (databaseError && typeof databaseError === "object" && "code" in databaseError && databaseError.code === "23505") {
      return { error: "That username or email is already in use.", status: 409 };
    }
    throw cause;
  }
}

export async function loginAccount(input: unknown): Promise<{ user: AccountUser; token: string } | { error: string; status: number }> {
  if (!input || typeof input !== "object") return { error: "Enter your email and password.", status: 400 };
  const fields = input as Record<string, unknown>;
  const email = typeof fields.email === "string" ? fields.email.trim().toLowerCase() : "";
  const password = fields.password;
  if (!email || typeof password !== "string") return { error: "Enter your email and password.", status: 400 };
  const [record] = await getDb().select().from(users).where(eq(users.email, email)).limit(1);
  if (!record || !await verifyPassword(password, record.passwordHash)) {
    return { error: "Email or password is incorrect.", status: 401 };
  }
  return {
    user: { userId: record.userId, username: record.username, email: record.email },
    token: await createSession(record.userId),
  };
}

async function createSession(userId: number): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await getDb().insert(userSessions).values({
    tokenHash: tokenHash(token), userId, expiresAt: new Date(Date.now() + sessionSeconds * 1000),
  });
  return token;
}

export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(cookieName, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: sessionSeconds,
  });
}

export async function getCurrentUser(): Promise<AccountUser | null> {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token || token.length > 100) return null;
  const [row] = await getDb().select({ userId: users.userId, username: users.username, email: users.email })
    .from(userSessions).innerJoin(users, eq(userSessions.userId, users.userId))
    .where(and(eq(userSessions.tokenHash, tokenHash(token)), gt(userSessions.expiresAt, new Date()))).limit(1);
  return row ?? null;
}

export async function logoutAccount(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName)?.value;
  if (token && token.length <= 100) await getDb().delete(userSessions).where(eq(userSessions.tokenHash, tokenHash(token)));
  cookieStore.delete(cookieName);
}

export async function getWorkspace(userId: number): Promise<BuyerWorkspace> {
  const [row] = await getDb().select().from(buyerWorkspaces).where(eq(buyerWorkspaces.userId, userId)).limit(1);
  return row ? {
    savedPropertyIds: row.savedPropertyIds ?? [],
    generalNotes: row.generalNotes ?? [],
    propertyNotes: row.propertyNotes ?? {},
    destinations: row.destinations ?? [],
    chatHistory: row.chatHistory ?? [],
  } : { ...emptyWorkspace };
}

export async function updateWorkspaceField<K extends WorkspaceField>(userId: number, field: K, value: BuyerWorkspace[K]): Promise<BuyerWorkspace> {
  const db = getDb();
  const set = { [field]: value, updatedAt: new Date() } as Partial<typeof buyerWorkspaces.$inferInsert>;
  await db.insert(buyerWorkspaces).values({ userId, ...set }).onConflictDoUpdate({ target: buyerWorkspaces.userId, set });
  return getWorkspace(userId);
}

export async function deleteAccount(userId: number): Promise<boolean> {
  const db = getDb();
  await db.delete(users).where(eq(users.userId, userId));
  const cookieStore = await cookies();
  cookieStore.delete(cookieName);
  return true;
}
