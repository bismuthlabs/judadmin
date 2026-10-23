"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { UserRole } from "@/lib/retail-types";
import {
  Button,
  DataTable,
  Field,
  Panel,
  SelectField,
  Status,
} from "@/components/retail-ui";

type Member = {
  id: string;
  name: string;
  role: UserRole;
  active: boolean;
  hasAccessCode: boolean;
};
type MemberResponse = { members?: Member[]; member?: Member; error?: string };

async function readResponse(response: Response): Promise<MemberResponse> {
  const text = await response.text();
  try {
    return JSON.parse(text) as MemberResponse;
  } catch {
    const detail = text.trim().slice(0, 240);
    throw new Error(
      detail ||
        `Server returned ${response.status}${response.statusText ? ` ${response.statusText}` : ""} without a JSON response.`,
    );
  }
}

export function MemberManagement({ activeUserId }: { activeUserId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("Cashier");
  const [passcode, setPasscode] = useState("");
  const [newPasscodes, setNewPasscodes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function loadMembers() {
    try {
      const response = await fetch("/api/admin/members");
      const result = await readResponse(response);
      if (!response.ok || !result.members)
        throw new Error(result.error ?? "Could not load members.");
      setMembers(result.members);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not load members.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetch("/api/admin/members")
      .then(async (response) => {
        const result = await readResponse(response);
        if (!response.ok || !result.members)
          throw new Error(result.error ?? "Could not load members.");
        if (active) setMembers(result.members);
      })
      .catch((error: unknown) =>
        toast.error(
          error instanceof Error ? error.message : "Could not load members.",
        ),
      )
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function request(url: string, method: "POST" | "PATCH", body: object) {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await readResponse(response);
    if (!response.ok)
      throw new Error(result.error ?? "Could not save member settings.");
    return result.member;
  }

  async function addMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      await request("/api/admin/members", "POST", { name, role, passcode });
      setName("");
      setPasscode("");
      setRole("Cashier");
      toast.success("Member added with an access code.");
      await loadMembers();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not add member.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveCode(member: Member) {
    const value = newPasscodes[member.id] ?? "";
    if (value.length < 6)
      return toast.error("Use a passcode with at least 6 characters.");
    setBusy(true);
    try {
      const updated = await request("/api/admin/members", "PATCH", {
        id: member.id,
        passcode: value,
      });
      setNewPasscodes((previous) => ({ ...previous, [member.id]: "" }));
      if (updated)
        setMembers((previous) =>
          previous.map((item) => (item.id === updated.id ? updated : item)),
        );
      toast.success(`Access code updated for ${member.name}.`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not update access code.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function updateMember(
    member: Member,
    changes: { role?: UserRole; active?: boolean },
  ) {
    setBusy(true);
    try {
      await request("/api/admin/members", "PATCH", {
        id: member.id,
        ...changes,
      });
      toast.success(
        changes.active === undefined
          ? "Member role updated."
          : changes.active
            ? "Member activated."
            : "Member deactivated.",
      );
      window.location.reload();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update member.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="settings-grid">
      <Panel>
        <div className="form-section-heading">
          <h2>Add team member</h2>
          <p>Create a member and assign their individual sign-in code.</p>
        </div>
        <form className="member-add-form" onSubmit={addMember}>
          <Field
            label="Name"
            required
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Cashier name"
          />
          <SelectField
            label="Role"
            value={role}
            onChange={(event) => setRole(event.target.value as UserRole)}
          >
            <option>Cashier</option>
            <option>Owner</option>
          </SelectField>
          <Field
            label="Access code"
            required
            minLength={6}
            maxLength={128}
            type="password"
            autoComplete="new-password"
            value={passcode}
            onChange={(event) => setPasscode(event.target.value)}
            placeholder="At least 6 characters"
          />
          <Button disabled={busy}>{busy ? "Saving…" : "Add member"}</Button>
        </form>
        <p className="form-footnote">
          Codes are stored as bcrypt hashes. Each active code must be unique.
        </p>
      </Panel>
      <Panel>
        <div className="panel-heading">
          <div>
            <h2>Team members</h2>
            <p>Each member unlocks the app with their own access code.</p>
          </div>
        </div>
        {loading ? (
          <p className="form-footnote">Loading members…</p>
        ) : (
          <DataTable
            empty={members.length ? undefined : "No team members yet."}
          >
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Access code</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {/* Keep the developer account ("Dev") out of the team members list. */}
              {members.filter((member) => member.name !== "Dev").map((member) => (
                <tr key={member.id}>
                  <td>
                    <strong>{member.name}</strong>
                    {member.id === activeUserId && (
                      <small className="table-subtext">You</small>
                    )}
                  </td>
                  <td>
                    <select
                      className="table-select"
                      aria-label={`Role for ${member.name}`}
                      disabled={busy || member.id === activeUserId}
                      value={member.role}
                      onChange={(event) =>
                        void updateMember(member, {
                          role: event.target.value as UserRole,
                        })
                      }
                    >
                      <option>Owner</option>
                      <option>Cashier</option>
                    </select>
                  </td>
                  <td>
                    <Status tone={member.active ? "green" : "neutral"}>
                      {member.active ? "Active" : "Inactive"}
                    </Status>
                  </td>
                  <td>
                    <Status tone={member.hasAccessCode ? "green" : "amber"}>
                      {member.hasAccessCode ? "Configured" : "Not set"}
                    </Status>
                  </td>
                  <td className="member-actions">
                    <input
                      className="table-code-input"
                      aria-label={`New access code for ${member.name}`}
                      type="password"
                      minLength={6}
                      maxLength={128}
                      autoComplete="new-password"
                      value={newPasscodes[member.id] ?? ""}
                      onChange={(event) =>
                        setNewPasscodes((previous) => ({
                          ...previous,
                          [member.id]: event.target.value,
                        }))
                      }
                      placeholder="New code"
                    />
                    <button
                      className="text-button"
                      disabled={
                        busy || (newPasscodes[member.id] ?? "").length < 6
                      }
                      onClick={() => void saveCode(member)}
                    >
                      Set code
                    </button>
                    <button
                      className="text-button"
                      disabled={busy || member.id === activeUserId}
                      onClick={() =>
                        void updateMember(member, { active: !member.active })
                      }
                    >
                      {member.active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Panel>
    </div>
  );
}
