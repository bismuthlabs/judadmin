import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { businessQuery } from "@/lib/server/supabase";

export const SESSION_COOKIE = "ee_session";
const ttl = Number(process.env.SESSION_TTL_SECONDS ?? 60 * 60 * 12);
type SessionPayload = { profileId: string; role: "Owner" | "Cashier"; issuedAt: number; expiresAt: number };
type ProfileRow = { id: string; name: string; role: "Owner" | "Cashier"; active: boolean };

function signature(encoded: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters.");
  return createHmac("sha256", secret).update(encoded).digest("base64url");
}

export function createSession(profile: ProfileRow) {
  const issuedAt = Date.now();
  const payload: SessionPayload = { profileId: profile.id, role: profile.role, issuedAt, expiresAt: issuedAt + ttl * 1000 };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return { value: `${encoded}.${signature(encoded)}`, maxAge: ttl };
}

export async function readSession(): Promise<(SessionPayload & { profile: ProfileRow }) | null> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!value) return null;
  const [encoded, supplied, extra] = value.split(".");
  if (!encoded || !supplied || extra) return null;
  const expected = Buffer.from(signature(encoded));
  const actual = Buffer.from(supplied);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString()) as SessionPayload;
    if (!payload.profileId || payload.expiresAt <= Date.now()) return null;
    const rows = await businessQuery<ProfileRow[]>(`profiles?id=eq.${encodeURIComponent(payload.profileId)}&active=eq.true&select=id,name,role,active`);
    const profile = rows[0];
    if (!profile || profile.role !== payload.role) return null;
    return { ...payload, profile };
  } catch {
    return null;
  }
}
