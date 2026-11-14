"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, errorMessage } from "@/lib/client";
import {
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  type Permission,
  type StaffRole,
} from "@/lib/permissions";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/modal";
import { Icon } from "@/components/ui/icons";

type RoleRow = {
  role: Exclude<StaffRole, "OWNER">;
  label: string;
  description: string;
  permissions: Permission[];
  customised: boolean;
};

export function RolePermissionEditor({
  roles,
  actorPermissions,
}: {
  roles: RoleRow[];
  actorPermissions: Permission[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [rows, setRows] = useState(roles);
  const [selected, setSelected] = useState<RoleRow>(roles[0]);
  const [draft, setDraft] = useState<Permission[]>(roles[0]?.permissions || []);
  const [pending, setPending] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [error, setError] = useState("");

  function choose(row: RoleRow) {
    setSelected(row);
    setDraft(row.permissions);
    setError("");
  }

  function toggle(permission: Permission, checked: boolean) {
    setDraft((current) => (checked ? [...new Set([...current, permission])] : current.filter((item) => item !== permission)));
  }

  function toggleGroup(group: Permission[], checked: boolean) {
    setDraft((current) => {
      if (checked) return [...new Set([...current, ...group])];
      return current.filter((item) => !group.includes(item));
    });
  }

  async function save() {
    setPending(true);
    setError("");
    try {
      const result = await apiRequest<{ role: StaffRole; permissions: Permission[] }>("/api/roles", {
        method: "PATCH",
        body: JSON.stringify({ role: selected.role, permissions: draft }),
      });
      const updated = rows.map((row) =>
        row.role === selected.role
          ? { ...row, permissions: result.permissions, customised: true }
          : row,
      );
      setRows(updated);
      setSelected({ ...selected, permissions: result.permissions, customised: true });
      setDraft(result.permissions);
      toast.success(`${selected.label} access updated.`);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function reset() {
    setPending(true);
    setError("");
    try {
      const result = await apiRequest<{ role: StaffRole; permissions: Permission[] }>(`/api/roles?role=${selected.role}`, {
        method: "DELETE",
      });
      const updated = rows.map((row) =>
        row.role === selected.role ? { ...row, permissions: result.permissions, customised: false } : row,
      );
      setRows(updated);
      setSelected({ ...selected, permissions: result.permissions, customised: false });
      setDraft(result.permissions);
      setResetOpen(false);
      toast.success(`${selected.label} reset to the standard access.`);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setResetOpen(false);
    } finally {
      setPending(false);
    }
  }

  const canSave = actorPermissions.includes("roles.write");
  const unavailable = draft.filter((permission) => !actorPermissions.includes(permission));

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="grid-2" style={{ alignItems: "start" }}>
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Roles</h2>
              <p>Choose a role to adjust what it can do.</p>
            </div>
          </div>
          <div className="card-body stack" style={{ gap: 8 }}>
            {rows.map((row) => (
              <button
                key={row.role}
                type="button"
                className={`dropdown-item ${selected.role === row.role ? "active" : ""}`}
                onClick={() => choose(row)}
                style={{ padding: "11px 12px", textAlign: "left", width: "100%" }}
              >
                <span className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{row.label.slice(0, 2).toUpperCase()}</span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", fontWeight: 600, fontSize: 12.5 }}>{row.label}</span>
                  <span className="hint">{row.permissions.length} permissions</span>
                </span>
                {row.customised ? <span className="badge badge-info">Custom</span> : null}
                <Icon name="chevron" style={{ width: 14, height: 14 }} />
              </button>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2>{selected.label}</h2>
              <p>{selected.description}</p>
            </div>
          </div>
          <div className="card-body stack" style={{ gap: 18 }}>
            {error ? <div className="alert alert-error">{error}</div> : null}
            {PERMISSION_GROUPS.map((group) => {
              const groupChecked = group.permissions.every((permission) => draft.includes(permission));
              return (
                <div key={group.label}>
                  <label className="row-between" style={{ paddingBottom: 7, borderBottom: "1px solid var(--line)" }}>
                    <strong style={{ fontSize: 12.5 }}>{group.label}</strong>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span className="hint">All</span>
                      <input
                        type="checkbox"
                        checked={groupChecked}
                        onChange={(event) => toggleGroup([...group.permissions], event.target.checked)}
                        disabled={!canSave || pending}
                      />
                    </span>
                  </label>
                  <div className="perm-grid" style={{ marginTop: 9 }}>
                    {group.permissions.map((permission) => {
                      const blocked = !actorPermissions.includes(permission);
                      return (
                        <label key={permission} className="perm-row" title={blocked ? "You cannot grant access you do not have" : undefined}>
                          <input
                            type="checkbox"
                            checked={draft.includes(permission)}
                            onChange={(event) => toggle(permission, event.target.checked)}
                            disabled={!canSave || pending || blocked}
                          />
                          <span>{PERMISSION_LABELS[permission]}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {unavailable.length ? (
              <p className="hint" style={{ margin: 0 }}>Some access is locked because your own role does not have it.</p>
            ) : null}
          </div>
          <div className="card-head" style={{ borderTop: "1px solid var(--line)", borderBottom: 0, justifyContent: "flex-end" }}>
            <div className="page-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setResetOpen(true)} disabled={!canSave || pending || !selected.customised}>
                Reset to standard
              </button>
              <button type="button" className="btn btn-primary" onClick={save} disabled={!canSave || pending}>
                {pending ? "Saving…" : "Save access"}
              </button>
            </div>
          </div>
        </section>
      </div>
      <p className="hint">
        These settings apply to every person with the role. Personal permission overrides on the Team page still take priority.
      </p>
      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={reset}
        title={`Reset ${selected.label} access?`}
        message="This returns the role to the standard access set by the app. Personal overrides are not changed."
        confirmLabel="Reset"
        pending={pending}
      />
    </div>
  );
}
