import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { readSession } from "@/lib/server/session";
import { businessQuery } from "@/lib/server/supabase";
import type { UserRole } from "@/lib/retail-types";

type Profile = { id: string; name: string; role: UserRole; active: boolean };
type AccessCode = { profile_id: string };
type Member = Profile & { hasAccessCode: boolean };

async function ownerSession() {
  const session = await readSession();
  return session?.role === "Owner" ? session : null;
}

async function listMembers(): Promise<Member[]> {
  const [profiles, codes] = await Promise.all([
    businessQuery<Profile[]>("profiles?select=id,name,role,active&order=created_at.asc"),
    businessQuery<AccessCode[]>("access_codes?select=profile_id"),
  ]);
  const codeProfiles = new Set(codes.map((code) => code.profile_id));
  return profiles.map((profile) => ({ ...profile, hasAccessCode: codeProfiles.has(profile.id) }));
}

async function codeAlreadyUsed(passcode: string, exceptProfileId?: string) {
  const codes = await businessQuery<Array<{ profile_id: string; hashed_code: string }>>("access_codes?select=profile_id,hashed_code");
  for (const code of codes) if (code.profile_id !== exceptProfileId && await bcrypt.compare(passcode, code.hashed_code)) return true;
  return false;
}

function validatePasscode(passcode: unknown): passcode is string {
  return typeof passcode === "string" && passcode.trim().length >= 6 && passcode.length <= 128;
}

export async function GET() {
  try {
    if (!await ownerSession()) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
    return NextResponse.json({ members: await listMembers() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load team members." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  let stage = "checking owner session";
  try {
    if (!await ownerSession()) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
    stage = "reading request";
    const body = await request.json() as { name?: string; role?: UserRole; passcode?: string };
    const name = body.name?.trim();
    if (!name || name.length > 100) return NextResponse.json({ error: "Enter a name up to 100 characters." }, { status: 400 });
    if (body.role !== "Owner" && body.role !== "Cashier") return NextResponse.json({ error: "Choose a valid role." }, { status: 400 });
    const passcode = body.passcode?.trim();
    if (!validatePasscode(passcode)) return NextResponse.json({ error: "Passcodes must be 6 to 128 characters." }, { status: 400 });
    stage = "checking whether the access code is already assigned";
    if (await codeAlreadyUsed(passcode)) return NextResponse.json({ error: "That passcode is already assigned to a member." }, { status: 409 });

    const id = `usr-${randomUUID()}`;
    stage = "creating the member profile";
    await businessQuery("profiles", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ id, name, role: body.role, active: true }) });
    try {
      stage = "saving the member access code";
      await businessQuery("access_codes", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ profile_id: id, hashed_code: await bcrypt.hash(passcode, 12), active: true }) });
    } catch (error) {
      stage = "rolling back the member profile after access code save failed";
      await businessQuery(`profiles?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      throw error;
    }
    stage = "loading the newly created member";
    return NextResponse.json({ member: (await listMembers()).find((member) => member.id === id) }, { status: 201 });
  } catch (error) {
    console.error(`Member creation failed while ${stage}.`, error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not add team member." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await ownerSession();
    if (!session) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
    const body = await request.json() as { id?: string; name?: string; role?: UserRole; active?: boolean; passcode?: string };
    if (!body.id) return NextResponse.json({ error: "Member id is required." }, { status: 400 });
    const members = await listMembers();
    const target = members.find((member) => member.id === body.id);
    if (!target) return NextResponse.json({ error: "Member not found." }, { status: 404 });
    const changesProfile = body.name !== undefined || body.role !== undefined || body.active !== undefined;
    if (target.id === session.profile.id && ((body.role !== undefined && body.role !== target.role) || body.active === false)) {
      return NextResponse.json({ error: "You cannot change or deactivate your own owner access." }, { status: 400 });
    }
    if (body.name !== undefined && (!body.name.trim() || body.name.trim().length > 100)) return NextResponse.json({ error: "Enter a name up to 100 characters." }, { status: 400 });
    if (body.role !== undefined && body.role !== "Owner" && body.role !== "Cashier") return NextResponse.json({ error: "Choose a valid role." }, { status: 400 });
    if (body.active !== undefined && typeof body.active !== "boolean") return NextResponse.json({ error: "Choose a valid member status." }, { status: 400 });
    if ((body.role === "Cashier" || body.active === false) && target.role === "Owner" && target.active && members.filter((member) => member.role === "Owner" && member.active).length <= 1) {
      return NextResponse.json({ error: "At least one active owner must remain." }, { status: 409 });
    }
    if (body.passcode !== undefined) {
      body.passcode = body.passcode.trim();
      if (!validatePasscode(body.passcode)) return NextResponse.json({ error: "Passcodes must be 6 to 128 characters." }, { status: 400 });
      if (await codeAlreadyUsed(body.passcode, target.id)) return NextResponse.json({ error: "That passcode is already assigned to a member." }, { status: 409 });
    }
    if (body.active === true && !body.passcode && !target.hasAccessCode) return NextResponse.json({ error: "Set an access code before activating this member." }, { status: 409 });

    if (changesProfile) {
      const profilePatch: Partial<Profile> = {};
      if (body.name !== undefined) profilePatch.name = body.name.trim();
      if (body.role !== undefined) profilePatch.role = body.role;
      if (body.active !== undefined) profilePatch.active = body.active;
      await businessQuery(`profiles?id=eq.${encodeURIComponent(target.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(profilePatch) });
    }
    if (body.active === true && !body.passcode) {
      const codes = await businessQuery<Array<{ id: string }>>(`access_codes?profile_id=eq.${encodeURIComponent(target.id)}&select=id&order=created_at.desc&limit=1`);
      if (codes[0]) await businessQuery(`access_codes?id=eq.${encodeURIComponent(codes[0].id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ active: true }) });
    }
    if (body.passcode !== undefined) {
      const inserted = await businessQuery<Array<{ id: string }>>("access_codes?select=id", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ profile_id: target.id, hashed_code: await bcrypt.hash(body.passcode, 12), active: body.active ?? target.active }) });
      const keepId = inserted[0]?.id;
      if (keepId) await businessQuery(`access_codes?profile_id=eq.${encodeURIComponent(target.id)}&active=eq.true&id=neq.${encodeURIComponent(keepId)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ active: false }) });
    }
    return NextResponse.json({ member: (await listMembers()).find((member) => member.id === target.id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update team member." }, { status: 503 });
  }
}
