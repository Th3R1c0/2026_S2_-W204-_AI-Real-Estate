import "server-only";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export function validateRegistration(value: unknown): { error: string } | { username: string; email: string; password: string } {
  if (!value || typeof value !== "object") return { error: "Enter a username, email, and password." };
  const fields = value as Record<string, unknown>;
  const username = typeof fields.username === "string" ? fields.username.trim() : "";
  const email = typeof fields.email === "string" ? fields.email.trim().toLowerCase() : "";
  const password = fields.password;
  if (!/^[a-zA-Z0-9_-]{3,50}$/.test(username)) return { error: "Username must be 3–50 letters, numbers, underscores, or hyphens." };
  if (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  if (typeof password !== "string" || password.length < 12 || Buffer.byteLength(password) > 256) {
    return { error: "Password must be at least 12 characters." };
  }
  return { username, email, password };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64) as Buffer;
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const parts = encodedHash.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt" || !/^[a-f0-9]{32}$/.test(parts[1]) || !/^[a-f0-9]{128}$/.test(parts[2])) return false;
  const actual = await scrypt(password, Buffer.from(parts[1], "hex"), 64) as Buffer;
  return timingSafeEqual(actual, Buffer.from(parts[2], "hex"));
}
