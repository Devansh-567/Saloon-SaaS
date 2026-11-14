"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, clearUrlParam, errorMessage } from "@/lib/client";
import { PERMISSIONS, ROLE_LABELS, effectivePermissions, type Permission, type StaffRole } from "@/lib/permissions";
import { formatDay, initials } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icons";

type Member = {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  role: StaffRole;
  active: boolean;
  branch: string | null;
  branchId: string | null;
  lastLoginAt: string | null;
  permissionOverrides: { grant?: Permission[]; revoke?: Permission[] } | null;
  profile: {
    bio: string | null;
    specialties: string[];
    color: string;
    commissionRate: number;
    schedule: unknown;
  } | null;
};

type Invitation = { id: string; email: string; role: StaffRole; expiresAt: string; createdAt: string };
type Branch = { id: string; name: string; active: boolean };

export function TeamPanel({
  members,
  invitations,
  branches,
  assignableRoles,
  currentUserId,
  timezone,
  locale,
  canWrite,
  rolePermissions,
  autoOpenInvite,
}: {
  members: Member[];
  invitations: Invitation[];
  branches: Branch[];
  assignableRoles: StaffRole[];
  currentUserId: string;
  timezone: string;
  locale: string;
  canWrite: boolean;
  rolePermissions: Record<StaffRole, Permission[]>;
  autoOpenInvite?: boolean;
}) {
  const [inviteOpen, setInviteOpen] = useState(Boolean(autoOpenInvite));
  const [editing, setEditing] = useState<Member | null>(null);

  function closeInvite() {
    setInviteOpen(false);
    if (autoOpenInvite) clearUrlParam("invite");
  }

  return (
    <>
      <section className="card">
        <div className="card-head">
          <div>
            <h2>Team members</h2>
            <p>Roles decide default access; per-person overrides fine-tune it.</p>
          </div>
          {canWrite ? (
            <button type="button" className="btn btn-primary" onClick={() => setInviteOpen(true)}>
              <Icon name="plus" /> Invite member
            </button>
          ) : null}
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th className="hide-mobile">Branch</th>
                <th className="hide-mobile num">Commission</th>
                <th>Status</th>
                <th className="hide-mobile">Last login</th>
                {canWrite ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id}>
                  <td>
                    <div className="member-cell">
                      <span className="avatar" style={{ background: member.profile?.color || undefined }}>
                        {initials(member.name)}
                      </span>
                      <span>
                        <span className="cell-title">{member.name}</span>
                        <span className="cell-sub">{member.email}</span>
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-plain">{ROLE_LABELS[member.role]}</span>
                    {member.permissionOverrides && (member.permissionOverrides.grant?.length || member.permissionOverrides.revoke?.length) ? (
                      <div className="cell-sub">Custom permissions</div>
                    ) : null}
                  </td>
                  <td className="hide-mobile">{member.branch || "All branches"}</td>
                  <td className="hide-mobile num">{member.profile ? `${member.profile.commissionRate}%` : "—"}</td>
                  <td>
                    <span className={`badge ${member.active ? "badge-success" : "badge-muted"}`}>
                      {member.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="hide-mobile">{member.lastLoginAt ? formatDay(member.lastLoginAt, timezone, locale) : "Never"}</td>
                  {canWrite ? (
                    <td>
                      <div className="actions">
                        {member.userId === currentUserId ? (
                          <span className="hint">You</span>
                        ) : member.role === "OWNER" ? null : (
                          <button type="button" className="icon-btn" title="Edit member" onClick={() => setEditing(member)}>
                            <Icon name="edit" />
                          </button>
                        )}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>Pending invitations</h2>
            <p>Invitations expire automatically after seven days.</p>
          </div>
          <span className="badge badge-plain">{invitations.length} pending</span>
        </div>
        {invitations.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th className="hide-mobile">Invited</th>
                  <th>Expires</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((invitation) => (
                  <tr key={invitation.id}>
                    <td>{invitation.email}</td>
                    <td><span className="badge badge-plain">{ROLE_LABELS[invitation.role]}</span></td>
                    <td className="hide-mobile">{formatDay(invitation.createdAt, timezone, locale)}</td>
                    <td>{formatDay(invitation.expiresAt, timezone, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="mail" title="No pending invitations" message="Invited teammates who have not joined yet appear here." />
        )}
      </section>

      {inviteOpen ? (
        <InviteDialog branches={branches} assignableRoles={assignableRoles} onClose={closeInvite} />
      ) : null}
      {editing ? (
        <MemberDialog
          member={editing}
          branches={branches}
          assignableRoles={assignableRoles}
          rolePermissions={rolePermissions}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

function InviteDialog({
  branches,
  assignableRoles,
  onClose,
}: {
  branches: Branch[];
  assignableRoles: StaffRole[];
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [copied, setCopied] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      const result = await apiRequest<{ inviteUrl: string; email: string }>("/api/team/invitations", {
        method: "POST",
        body: JSON.stringify({
          email: form.get("email"),
          role: form.get("role"),
          branchId: form.get("branchId") || null,
          commissionRate: Number(form.get("commissionRate")) || 0,
        }),
      });
      setInviteUrl(result.inviteUrl);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success("Invitation link copied.");
    } catch {
      toast.error("Could not copy. Select the link and copy manually.");
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={inviteUrl ? "Invitation created" : "Invite team member"}
      description={inviteUrl ? "Share this single-use link with your teammate. It expires in seven days." : "They will set their own password when accepting."}
      footer={
        inviteUrl ? (
          <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
        ) : (
          <>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>Cancel</button>
            <button type="submit" form="invite-form" className="btn btn-primary" disabled={pending}>
              {pending ? "Creating…" : "Create invitation"}
            </button>
          </>
        )
      }
    >
      {error ? <div className="alert alert-error">{error}</div> : null}
      {inviteUrl ? (
        <div className="stack">
          <div className="alert alert-success">Invitation ready. If email delivery is not configured, share the link directly.</div>
          <div className="copy-field">
            <input className="input" value={inviteUrl} readOnly onFocus={(event) => event.currentTarget.select()} />
            <button type="button" className="btn btn-secondary" onClick={copy}>
              <Icon name={copied ? "check" : "file"} /> {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      ) : (
        <form id="invite-form" onSubmit={submit}>
          <div className="form-grid">
            <div className="field span-2">
              <label htmlFor="invite-email">Email</label>
              <input id="invite-email" name="email" type="email" className="input" required autoFocus />
            </div>
            <div className="field">
              <label htmlFor="invite-role">Role</label>
              <select id="invite-role" name="role" className="select" defaultValue={assignableRoles.at(-1) || "STAFF"}>
                {assignableRoles.map((role) => (
                  <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="invite-commission">Commission (%)</label>
              <input id="invite-commission" name="commissionRate" type="number" min={0} max={100} step="0.1" className="input" defaultValue={0} />
            </div>
            <div className="field span-2">
              <label htmlFor="invite-branch">Branch</label>
              <select id="invite-branch" name="branchId" className="select">
                <option value="">All branches</option>
                {branches.filter((branch) => branch.active).map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}

function MemberDialog({
  member,
  branches,
  assignableRoles,
  rolePermissions,
  onClose,
}: {
  member: Member;
  branches: Branch[];
  assignableRoles: StaffRole[];
  rolePermissions: Record<StaffRole, Permission[]>;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [role, setRole] = useState<StaffRole>(member.role);
  const [active, setActive] = useState(member.active);
  const [color, setColor] = useState(member.profile?.color || "#8c6a52");
  const [grant, setGrant] = useState<Permission[]>(member.permissionOverrides?.grant || []);
  const [revoke, setRevoke] = useState<Permission[]>(member.permissionOverrides?.revoke || []);
  const roleOptions = assignableRoles.includes(member.role) ? assignableRoles : [member.role, ...assignableRoles];
  const defaults = effectivePermissions(role, {}, rolePermissions[role]);

  function togglePermission(permission: Permission, checked: boolean) {
    const isDefault = defaults.includes(permission);
    if (checked) {
      setRevoke((current) => current.filter((item) => item !== permission));
      if (!isDefault) setGrant((current) => (current.includes(permission) ? current : [...current, permission]));
    } else {
      setGrant((current) => current.filter((item) => item !== permission));
      if (isDefault) setRevoke((current) => (current.includes(permission) ? current : [...current, permission]));
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      await apiRequest(`/api/team/${member.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          role,
          branchId: form.get("branchId") || null,
          active,
          permissionOverrides: { grant, revoke },
          staffProfile: {
            bio: form.get("bio") || null,
            specialties: String(form.get("specialties") || "")
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
            color,
            commissionRate: Number(form.get("commissionRate")) || 0,
          },
        }),
      });
      toast.success("Team member updated.");
      onClose();
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${member.name}`}
      description="Role changes take effect on their next request."
      wide
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>Cancel</button>
          <button type="submit" form="member-form" className="btn btn-primary" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </button>
        </>
      }
    >
      {error ? <div className="alert alert-error">{error}</div> : null}
      <form id="member-form" onSubmit={submit}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="member-role">Role</label>
            <select id="member-role" className="select" value={role} onChange={(event) => setRole(event.target.value as StaffRole)}>
              {roleOptions.map((option) => (
                <option key={option} value={option}>{ROLE_LABELS[option]}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="member-branch">Branch</label>
            <select id="member-branch" name="branchId" className="select" defaultValue={member.branchId || ""}>
              <option value="">All branches</option>
              {branches.filter((branch) => branch.active || branch.id === member.branchId).map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="member-commission">Commission (%)</label>
            <input id="member-commission" name="commissionRate" type="number" min={0} max={100} step="0.1" className="input" defaultValue={member.profile?.commissionRate ?? 0} />
          </div>
          <div className="field">
            <label htmlFor="member-color">Calendar colour</label>
            <input id="member-color" type="color" className="input" value={color} onChange={(event) => setColor(event.target.value)} style={{ padding: 4, height: 40 }} />
          </div>
          <div className="field span-2">
            <label htmlFor="member-specialties">Specialties</label>
            <input id="member-specialties" name="specialties" className="input" defaultValue={(member.profile?.specialties || []).join(", ")} placeholder="Colour, Balayage, Bridal styling" />
          </div>
          <div className="field span-2">
            <label htmlFor="member-bio">Bio</label>
            <textarea id="member-bio" name="bio" className="textarea" defaultValue={member.profile?.bio || ""} />
          </div>
          <div className="field span-2">
            <label>Account status</label>
            <label className="switch">
              <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
              <span>{active ? "Active — can sign in" : "Inactive — access revoked"}</span>
            </label>
          </div>
        </div>

        <div className="section-divider">
          <div className="row-between">
            <div>
              <strong>Permission overrides</strong>
              <p className="hint" style={{ margin: "2px 0 0" }}>Highlighted items differ from the {ROLE_LABELS[role]} defaults.</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setGrant([]); setRevoke([]); }}>
                Reset to defaults
              </button>
            </div>
          </div>
          <div className="perm-grid" style={{ marginTop: 12 }}>
            {PERMISSIONS.map((permission) => {
              const isDefault = defaults.includes(permission);
              const effective = effectivePermissions(role, { grant, revoke }, rolePermissions[role]).includes(permission);
              const overridden = effective !== isDefault;
              return (
                <label key={permission} className={`perm-row ${overridden ? "overridden" : ""}`}>
                  <input type="checkbox" checked={effective} onChange={(event) => togglePermission(permission, event.target.checked)} />
                  <span>{permission.replace(".", " · ")}</span>
                </label>
              );
            })}
          </div>
        </div>
      </form>
    </Modal>
  );
}
