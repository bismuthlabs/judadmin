import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { businessQuery } from "@/lib/server/supabase";
import { createSession, SESSION_COOKIE } from "@/lib/server/session";

type AccessCode = { id: string; profile_id: string; hashed_code: string; active: boolean };
type Profile = { id: string; name: string; role: "Owner" | "Cashier"; active: boolean };

export async function POST(request: Request) {
  try {
    const body = await request.json() as { passcode?: string };
    const passcode = body.passcode?.trim();
    if (!passcode || passcode.length > 128) return NextResponse.json({ error: "Enter a valid passcode." }, { status: 400 });
    const codes = await businessQuery<AccessCode[]>("access_codes?active=eq.true&select=id,profile_id,hashed_code");
    let matched: AccessCode | undefined;
    for (const code of codes) if (await bcrypt.compare(passcode, code.hashed_code)) { matched = code; break; }
    if (!matched) return NextResponse.json({ error: "That passcode is not valid or active." }, { status: 401 });
    const profiles = await businessQuery<Profile[]>(`profiles?id=eq.${encodeURIComponent(matched.profile_id)}&active=eq.true&select=id,name,role,active`);
    if (!profiles[0]) return NextResponse.json({ error: "This profile is inactive." }, { status: 401 });
    const session = createSession(profiles[0]);
    const response = NextResponse.json({ profile: profiles[0] });
    response.cookies.set(SESSION_COOKIE, session.value, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: session.maxAge });
    return response;
  } catch (error) {
    console.error("Unlock failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not unlock the workspace." }, { status: 503 });
  }
}
