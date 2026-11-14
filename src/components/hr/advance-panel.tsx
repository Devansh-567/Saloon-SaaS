"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, errorMessage } from "@/lib/client";
import { ADVANCE_STATUS_LABELS, advanceTone, type AdvanceStatusValue } from "@/lib/hr";
import { formatDay, formatMoney, initials } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icons";

type AdvanceRow = {
  id: string;
  membershipId: string;
  member: string;
  amount: number;
  reason: string | null;
  requestedAt: string;
  status: string;
  decidedBy: string | null;
  decidedAt: string | null;
  paidAt: string | null;
  notes: string | null;
};

type Member = { id: string; name: string };

export function AdvancePanel({
  rows,
  members,
  selfMembershipId,
  currency,
  locale,
  timezone,
  canDecide,
  canRequest,
  showMember,
}: {
  rows: AdvanceRow[];
  members: Member[];
  selfMembershipId: string;
  currency: string;
  locale: string;
  timezone: string;
  canDecide: boolean;
  canRequest: boolean;
  showMember: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [requestOpen, setRequestOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function decide(row: AdvanceRow, status: AdvanceStatusValue) {
    setPendingId(row.id);
    try {
      await apiRequest(`/api/hr/advances/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      toast.success(`Advance ${ADVANCE_STATUS_LABELS[status].toLowerCase()}.`);
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
            <h2>Salary advances</h2>
            <p>Requests and repayments for money taken before payday.</p>
          </div>
          {canRequest ? (
            <button type="button" className="btn btn-secondary" onClick={() => setRequestOpen(true)}>
              <Icon name="plus" /> Ask for advance
            </button>
          ) : null}
        </div>
        {rows.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  {showMember ? <th>Staff</th> : null}
                  <th className="num">Amount</th>
                  <th className="hide-mobile">Asked</th>
                  <th>Status</th>
                  <th className="hide-mobile">Reason</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isOwn = row.membershipId === selfMembershipId;
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
                      <td className="num"><strong>{formatMoney(row.amount, currency, locale)}</strong></td>
                      <td className="hide-mobile">{formatDay(row.requestedAt, timezone, locale)}</td>
                      <td>
                        <span className={`badge ${advanceTone(row.status)}`}>
                          {ADVANCE_STATUS_LABELS[row.status as AdvanceStatusValue] || row.status}
                        </span>
                        {row.notes ? <div className="cell-sub">{row.notes}</div> : null}
                      </td>
                      <td className="hide-mobile" style={{ maxWidth: 220 }}>{row.reason || "—"}</td>
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
                          {row.status === "APPROVED" && canDecide && !isOwn ? (
                            <button type="button" className="btn btn-primary btn-sm" onClick={() => decide(row, "PAID")} disabled={pendingId === row.id}>
                              Mark paid
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
          <EmptyState icon="money" title="No advances" message="Staff advance requests will appear here." />
        )}
      </section>
      {requestOpen ? (
        <AdvanceRequestDialog
          members={members}
          selfMembershipId={selfMembershipId}
          currency={currency}
          onClose={() => setRequestOpen(false)}
        />
      ) : null}
    </>
  );
}

function AdvanceRequestDialog({
  members,
  selfMembershipId,
  currency,
  onClose,
}: {
  members: Member[];
  selfMembershipId: string;
  currency: string;
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
      await apiRequest("/api/hr/advances", {
        method: "POST",
        body: JSON.stringify({
          ...(canChoose ? { membershipId: form.get("membershipId") } : { membershipId: selfMembershipId }),
          amount: Number(form.get("amount")) || 0,
          reason: String(form.get("reason") || "").trim() || null,
        }),
      });
      toast.success("Advance request sent.");
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
      title="Ask for an advance"
      description="Your owner or manager will review the amount."
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>Cancel</button>
          <button type="submit" form="advance-form" className="btn btn-primary" disabled={pending}>
            {pending ? "Sending…" : "Send request"}
          </button>
        </>
      }
    >
      {error ? <div className="alert alert-error">{error}</div> : null}
      <form id="advance-form" onSubmit={submit}>
        <div className="form-grid">
          {canChoose ? (
            <div className="field span-2">
              <label htmlFor="advance-member">Staff member</label>
              <select id="advance-member" name="membershipId" className="select" defaultValue={members[0]?.id} required>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="advance-amount">Amount ({currency})</label>
            <input id="advance-amount" name="amount" type="number" min="1" step="0.01" className="input" required autoFocus />
          </div>
          <div className="field span-2">
            <label htmlFor="advance-reason">Reason</label>
            <textarea id="advance-reason" name="reason" className="textarea" rows={2} placeholder="Medical bill, school fees…" />
          </div>
        </div>
      </form>
    </Modal>
  );
}
