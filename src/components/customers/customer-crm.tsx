"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, errorMessage } from "@/lib/client";
import { formatDate, formatDay, initials } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icons";

type Note = { id: string; body: string; author: string; createdAt: string };
type FollowUp = {
  id: string;
  title: string;
  notes: string | null;
  dueAt: string;
  status: string;
  assignedTo: string | null;
  assignedToMembershipId: string | null;
  completedAt: string | null;
};
type Member = { id: string; name: string };

const STATUS_STYLES: Record<string, string> = {
  OPEN: "badge-warning",
  DONE: "badge-success",
  CANCELLED: "badge-muted",
};

function toLocalInput(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

export function CustomerCrm({
  customerId,
  customerName,
  notes,
  followUps,
  members,
  timezone,
  locale,
  canWrite,
}: {
  customerId: string;
  customerName: string;
  notes: Note[];
  followUps: FollowUp[];
  members: Member[];
  timezone: string;
  locale: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [note, setNote] = useState("");
  const [notePending, setNotePending] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function addNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotePending(true);
    try {
      await apiRequest(`/api/customers/${customerId}/notes`, {
        method: "POST",
        body: JSON.stringify({ body: note }),
      });
      setNote("");
      toast.success("Note added.");
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setNotePending(false);
    }
  }

  async function updateFollowUp(id: string, status: string) {
    setPendingId(id);
    try {
      await apiRequest(`/api/customers/${customerId}/follow-ups/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      toast.success(status === "DONE" ? "Reminder marked done." : status === "CANCELLED" ? "Reminder cancelled." : "Reminder reopened.");
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPendingId(null);
    }
  }

  async function removeFollowUp(id: string) {
    setPendingId(id);
    try {
      await apiRequest(`/api/customers/${customerId}/follow-ups/${id}`, { method: "DELETE" });
      toast.success("Reminder deleted.");
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPendingId(null);
    }
  }

  const openFollowUps = followUps.filter((item) => item.status === "OPEN");
  const closedFollowUps = followUps.filter((item) => item.status !== "OPEN");

  return (
    <div className="grid-2">
      <section className="card">
        <div className="card-head">
          <div>
            <h2>Reminders</h2>
            <p>{openFollowUps.length} open for {customerName}</p>
          </div>
          {canWrite ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setFollowUpOpen(true)}>
              <Icon name="plus" /> Add follow-up
            </button>
          ) : null}
        </div>
        {followUps.length ? (
          <div className="stack" style={{ gap: 0 }}>
            {[...openFollowUps, ...closedFollowUps].map((item) => (
              <div key={item.id} style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
                <div className="row-between" style={{ alignItems: "flex-start", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{item.title}</div>
                    <div className="cell-sub">
                      Due {formatDate(item.dueAt, timezone, locale)}
                      {item.assignedTo ? ` · ${item.assignedTo}` : ""}
                    </div>
                    {item.notes ? <p className="hint" style={{ margin: "5px 0 0" }}>{item.notes}</p> : null}
                  </div>
                  <span className={`badge ${STATUS_STYLES[item.status] || "badge-plain"}`}>{item.status.toLowerCase()}</span>
                </div>
                {canWrite ? (
                  <div className="actions" style={{ justifyContent: "flex-start", marginTop: 8 }}>
                    {item.status === "OPEN" ? (
                      <>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => updateFollowUp(item.id, "DONE")} disabled={pendingId === item.id}>
                          Done
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => updateFollowUp(item.id, "CANCELLED")} disabled={pendingId === item.id}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => updateFollowUp(item.id, "OPEN")} disabled={pendingId === item.id}>
                        Reopen
                      </button>
                    )}
                    <button type="button" className="icon-btn" title="Delete reminder" onClick={() => removeFollowUp(item.id)} disabled={pendingId === item.id}>
                      <Icon name="trash" />
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon="calendar" title="No reminders" message="Set a reminder to call back, check in, or invite this customer again." />
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>Notes</h2>
            <p>{notes.length} note{notes.length === 1 ? "" : "s"} on this customer</p>
          </div>
        </div>
        {canWrite ? (
          <form onSubmit={addNote} style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
            <div className="field">
              <label htmlFor="customer-note">Add a note</label>
              <textarea
                id="customer-note"
                className="textarea"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Likes a quiet chair, allergic to ammonia, prefers evening slots…"
                required
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={notePending || !note.trim()}>
                {notePending ? "Adding…" : "Add note"}
              </button>
            </div>
          </form>
        ) : null}
        {notes.length ? (
          <div className="stack" style={{ gap: 0 }}>
            {notes.map((item) => (
              <div key={item.id} style={{ padding: "13px 20px", borderBottom: "1px solid var(--line)" }}>
                <div style={{ fontSize: 12.5, whiteSpace: "pre-wrap" }}>{item.body}</div>
                <div className="cell-sub" style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 5 }}>
                  <span className="avatar" style={{ width: 20, height: 20, fontSize: 8 }}>{initials(item.author)}</span>
                  {item.author} · {formatDay(item.createdAt, timezone, locale)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon="file" title="No notes yet" message="Private notes help your team remember what matters." />
        )}
      </section>

      {followUpOpen ? (
        <FollowUpDialog
          customerId={customerId}
          members={members}
          onClose={() => setFollowUpOpen(false)}
        />
      ) : null}
    </div>
  );
}

function FollowUpDialog({
  customerId,
  members,
  onClose,
}: {
  customerId: string;
  members: Member[];
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const defaultDue = toLocalInput(new Date(Date.now() + 86400000).toISOString());

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const due = String(form.get("dueAt") || "");
    setPending(true);
    setError("");
    try {
      await apiRequest(`/api/customers/${customerId}/follow-ups`, {
        method: "POST",
        body: JSON.stringify({
          title: form.get("title"),
          notes: String(form.get("notes") || "").trim() || null,
          dueAt: new Date(due).toISOString(),
          assignedToMembershipId: form.get("assignedToMembershipId") || null,
        }),
      });
      toast.success("Reminder added.");
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
      title="Add reminder"
      description="A simple reminder for you or a teammate."
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>Cancel</button>
          <button type="submit" form="follow-up-form" className="btn btn-primary" disabled={pending}>
            {pending ? "Saving…" : "Add reminder"}
          </button>
        </>
      }
    >
      {error ? <div className="alert alert-error">{error}</div> : null}
      <form id="follow-up-form" onSubmit={submit}>
        <div className="form-grid">
          <div className="field span-2">
            <label htmlFor="follow-up-title">What is it for?</label>
            <input id="follow-up-title" name="title" className="input" required placeholder="Call about colour appointment" autoFocus />
          </div>
          <div className="field">
            <label htmlFor="follow-up-due">When</label>
            <input id="follow-up-due" name="dueAt" type="datetime-local" className="input" defaultValue={defaultDue} required />
          </div>
          <div className="field">
            <label htmlFor="follow-up-staff">Assign to</label>
            <select id="follow-up-staff" name="assignedToMembershipId" className="select">
              <option value="">Anyone</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
          </div>
          <div className="field span-2">
            <label htmlFor="follow-up-notes">Notes</label>
            <textarea id="follow-up-notes" name="notes" className="textarea" rows={2} />
          </div>
        </div>
      </form>
    </Modal>
  );
}
