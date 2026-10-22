import { NextResponse } from "next/server";
import { readSession, SESSION_COOKIE } from "@/lib/server/session";

export async function GET() {
  try {
    const session = await readSession();
    return NextResponse.json({ profile: session?.profile ?? null });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Session check failed." }, { status: 503 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
