import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "./queries/connection";
import { users, type User } from "@db/schema";

const COOKIE_NAME = "neurostart_session";
const MAX_AGE = 60 * 60 * 24 * 30;

function secret() {
  const value = process.env.APP_SECRET;
  if (!value || value.length < 32) throw new Error("APP_SECRET is not configured");
  return value;
}

function encode(value: string) {
  return Buffer.from(value).toString("base64url");
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64);
  const target = Buffer.from(expected, "hex");
  return actual.length === target.length && timingSafeEqual(actual, target);
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createToken(user: User) {
  const payload = encode(JSON.stringify({ sub: user.id, exp: Date.now() + MAX_AGE * 1000 }));
  return `${payload}.${sign(payload)}`;
}

function readToken(req: Request) {
  const cookies = req.headers.get("cookie") || "";
  const token = cookies.split(/;\s*/).find((item) => item.startsWith(`${COOKIE_NAME}=`))?.split("=").slice(1).join("=");
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { sub: number; exp: number };
    if (!data.sub || data.exp < Date.now()) return null;
    return data.sub;
  } catch {
    return null;
  }
}

export async function getSessionUser(req: Request) {
  const userId = readToken(req);
  if (!userId) return null;
  const [user] = await getDb().select().from(users).where(eq(users.id, userId)).limit(1);
  return user || null;
}

export function publicUser(user: User) {
  return { id: user.id, email: user.email, displayName: user.displayName, role: user.role };
}

export { COOKIE_NAME, MAX_AGE };
