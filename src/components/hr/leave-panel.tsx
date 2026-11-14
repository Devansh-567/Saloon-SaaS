"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, errorMessage } from "@/lib/client";
import {
  LEAVE_STATUS_LABELS,
  LEAVE_TYPES,
  LEAVE_TYPE_LABELS,
  leaveTone,
  type LeaveStatusValue,
} from "@/lib/hr";
import { formatDateOnly, initials } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icons";

type LeaveRow = {
  id: string;
  membershipId: string;
  member: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: string;
  decisionNote: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
};

type Member = { id: string; name: string };

export function LeavePanel({
  rows,
  members,
  selfMembershipId,
  today,
  locale,
  canDecide,
  canRequest,
  showMember,
}: {
  rows: LeaveRow[];
  members: Member[];
  selfMembershipId: string;
  today: string;
  locale: string;
  canDecide: boolean;
  canRequest: boolean;
  showMember: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [requestOpen, setRequestOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function decide(row: LeaveRow, status: LeaveStatusValue) {
    setPendingId(row.id);
    try {
      await apiRequest(`/api/hr/leave/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      toast.success(`Leave request ${LEAVE_STATUS_LABELS[status].toLowerCase()}.`);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <>
      <section className="card">
        <div className="card-head">
          <div>
            <h2>Leave requests</h2>
            <p>Approve time off, or ask for leave yourself.</p>
          </div>
          {canRequest ? (
            <button type="button" className="btn btn-primary" onClick={() => setRequestOpen(true)}>
              <Icon name="plus" /> Ask for leave
            </button>
          ) : null}
        </div>
        {rows.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  {showMember ? <th>Staff</th> : null}
                  <th>Dates</th>
                  <th className="hide-mobile">Type</th>
                  <th>Status</th>
                  <th className="hide-mobile">Reason</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isOwn = row.membershipId === selfMembershipId;
                  const status = row.status as LeaveStatusValue;
                  return (
                    <tr key={row.id}>
                      {showMember ? (
                        <td>
                          <div className="member-cell">
                            <span className="avatar">{initials(row.member)}</span>
                            <span className="cell-title">{row.member}</span>
                          </div>
                        </td>
                      ) : null}
                      <td>
                        <span className="cell-title">
                          {formatDateOnly(row.startDate, locale)}
                          {row.endDate !== row.startDate ? ` – ${formatDateOnly(row.endDate, locale)}` : ""}
                        </span>
                        <span className="cell-sub">{row.days} day{row.days === 1 ? "" : "s"}</span>
                      </td>
                      <td className="hide-mobile">{LEAVE_TYPE_LABELS[row.type as keyof typeof LEAVE_TYPE_LABELS] || row.type}</td>
                      <td>
                        <span className={`badge ${leaveTone(row.status)}`}>{LEAVE_STATUS_LABELS[status] || row.status}</span>
                        {row.decisionNote ? <div className="cell-sub">{row.decisionNote}</div> : null}
                      </td>
                      <td className="hide-mobile" style={{ maxWidth: 260 }}>{row.reason}</td>
                      <td>
                        <div className="actions">
                          {row.status === "PENDING" && canDecide && !isOwn ? (
                            <>
                              <button type="button" className="btn btn-primary btn-sm" onClick={() => decide(row, "APPROVED")} disabled={pendingId === row.id}>
                                Approve
                              </button>
                              <button type="button" className="btn btn-secondary btn-sm" onClick={() => decide(row, "REJECTED")} disabled={pendingId === row.id}>
                                No
                              </button>
                            </>
                          ) : null}
                          {row.status === "PENDING" && isOwn ? (
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => decide(row, "CANCELLED")} disabled={pendingId === row.id}>
                              Cancel
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="calendar" title="No leave requests" message="Time-off requests and their decisions will appear here." />
        )}
      </section>
      {requestOpen ? (
        <LeaveRequestDialog
          members={members}
          selfMembershipId={selfMembershipId}
          today={today}
          onClose={() => setRequestOpen(false)}
        />
      ) : null}
    </>
  );
}

function LeaveRequestDialog({
  members,
  selfMembershipId,
  today,
  onClose,
}: {
  members: Member[];
  selfMembershipId: string;
  today: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const canChoose = members.length > 0;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      await apiRequest("/api/hr/leave", {
        method: "POST",
        body: JSON.stringify({
          ...(canChoose ? { membershipId: form.get("membershipId") } : { membershipId: selfMembershipId }),
          type: form.get("type"),
          startDate: form.get("startDate"),
          endDate: form.get("endDate"),
          reason: form.get("reason"),
        }),
      });
      toast.success("Leave request sent.");
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
      title="Ask for leave"
      description="Your owner or manager will review this request."
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>Cancel</button>
          <button type="submit" form="leave-form" className="btn btn-primary" disabled={pending}>
            {pending ? "Sending…" : "Send request"}
          </button>
        </>
      }
    >
      {error ? <div className="alert alert-error">{error}</div> : null}
      <form id="leave-form" onSubmit={submit}>
        <div className="form-grid">
          {canChoose ? (
            <div className="field span-2">
              <label htmlFor="leave-member">Staff member</label>
              <select id="leave-member" name="membershipId" className="select" defaultValue={members[0]?.id} required>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="leave-type">Type</label>
            <select id="leave-type" name="type" className="select" defaultValue="CASUAL">
              {LEAVE_TYPES.map((type) => (
                <option key={type} value={type}>{LEAVE_TYPE_LABELS[type]}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="leave-start">From</label>
            <input id="leave-start" name="startDate" type="date" className="input" defaultValue={today} required />
          </div>
          <div className="field">
            <label htmlFor="leave-end">To</label>
            <input id="leave-end" name="endDate" type="date" className="input" defaultValue={today} required />
          </div>
          <div className="field span-2">
            <label htmlFor="leave-reason">Reason</label>
            <textarea id="leave-reason" name="reason" className="textarea" required placeholder="Family function, medical rest…" />
          </div>
        </div>
      </form>
    </Modal>
  );
}
