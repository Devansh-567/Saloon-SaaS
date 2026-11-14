"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, errorMessage } from "@/lib/client";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethodValue } from "@/lib/hr";
import { formatDateOnly, formatDay, formatMoney, initials } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icons";

type SalaryRow = {
  id: string;
  membershipId: string;
  member: string;
  periodStart: string;
  periodEnd: string;
  baseAmount: number;
  bonus: number;
  deductions: number;
  advanceDeduction: number;
  netAmount: number;
  method: string;
  status: string;
  paidAt: string;
  notes: string | null;
};

type Member = {
  id: string;
  name: string;
  profile: { monthlySalary: number };
};

export function SalaryPanel({
  rows,
  members,
  currency,
  locale,
  timezone,
  defaultPeriodStart,
  defaultPeriodEnd,
  canWrite,
  canDelete,
}: {
  rows: SalaryRow[];
  members: Member[];
  currency: string;
  locale: string;
  timezone: string;
  defaultPeriodStart: string;
  defaultPeriodEnd: string;
  canWrite: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState<SalaryRow | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const total = rows.reduce((sum, row) => sum + row.netAmount, 0);

  async function remove() {
    if (!deleting) return;
    setDeletePending(true);
    try {
      await apiRequest(`/api/hr/salary/${deleting.id}`, { method: "DELETE" });
      toast.success("Salary record deleted.");
      setDeleting(null);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <>
      <section className="card">
        <div className="card-head">
          <div>
            <h2>Salary payments</h2>
            <p>{rows.length} payment{rows.length === 1 ? "" : "s"} · {formatMoney(total, currency, locale)} paid</p>
          </div>
          {canWrite ? (
            <button type="button" className="btn btn-primary" onClick={() => setAddOpen(true)} disabled={!members.length}>
              <Icon name="plus" /> Record salary
            </button>
          ) : null}
        </div>
        {rows.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Period</th>
                  <th className="hide-mobile num">Base</th>
                  <th className="hide-mobile num">Extra</th>
                  <th className="hide-mobile num">Deducted</th>
                  <th className="num">Net paid</th>
                  <th className="hide-mobile">Method</th>
                  <th className="hide-mobile">Paid on</th>
                  {canDelete ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="member-cell">
                        <span className="avatar">{initials(row.member)}</span>
                        <span className="cell-title">{row.member}</span>
                      </div>
                    </td>
                    <td>
                      <span className="cell-title">{formatDateOnly(row.periodStart, locale)} – {formatDateOnly(row.periodEnd, locale)}</span>
                    </td>
                    <td className="hide-mobile num">{formatMoney(row.baseAmount, currency, locale)}</td>
                    <td className="hide-mobile num">{formatMoney(row.bonus, currency, locale)}</td>
                    <td className="hide-mobile num">{formatMoney(row.deductions + row.advanceDeduction, currency, locale)}</td>
                    <td className="num"><strong>{formatMoney(row.netAmount, currency, locale)}</strong></td>
                    <td className="hide-mobile">{PAYMENT_METHOD_LABELS[row.method as PaymentMethodValue] || row.method}</td>
                    <td className="hide-mobile">{formatDay(row.paidAt, timezone, locale)}</td>
                    {canDelete ? (
                      <td>
                        <button type="button" className="icon-btn" title="Delete salary record" onClick={() => setDeleting(row)}>
                          <Icon name="trash" />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="money" title="No salary payments yet" message="Record a salary payment after paying your team." />
        )}
      </section>
      {addOpen ? (
        <SalaryDialog
          members={members}
          currency={currency}
          locale={locale}
          defaultPeriodStart={defaultPeriodStart}
          defaultPeriodEnd={defaultPeriodEnd}
          onClose={() => setAddOpen(false)}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title="Delete salary record?"
        message={deleting ? `This removes the ${formatMoney(deleting.netAmount, currency, locale)} payment for ${deleting.member} from reports.` : ""}
        confirmLabel="Delete"
        danger
        pending={deletePending}
      />
    </>
  );
}

function SalaryDialog({
  members,
  currency,
  locale,
  defaultPeriodStart,
  defaultPeriodEnd,
  onClose,
}: {
  members: Member[];
  currency: string;
  locale: string;
  defaultPeriodStart: string;
  defaultPeriodEnd: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [memberId, setMemberId] = useState(members[0]?.id || "");
  const [base, setBase] = useState(String(members[0]?.profile.monthlySalary || ""));
  const [bonus, setBonus] = useState("0");
  const [deductions, setDeductions] = useState("0");
  const [advance, setAdvance] = useState("0");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const net = useMemo(() => {
    return Math.max(0, (Number(base) || 0) + (Number(bonus) || 0) - (Number(deductions) || 0) - (Number(advance) || 0));
  }, [base, bonus, deductions, advance]);

  function changeMember(id: string) {
    setMemberId(id);
    const member = members.find((item) => item.id === id);
    setBase(member?.profile.monthlySalary ? String(member.profile.monthlySalary) : "");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      await apiRequest("/api/hr/salary", {
        method: "POST",
        body: JSON.stringify({
          membershipId: memberId,
          periodStart: form.get("periodStart"),
          periodEnd: form.get("periodEnd"),
          baseAmount: Number(base) || 0,
          bonus: Number(bonus) || 0,
          deductions: Number(deductions) || 0,
          advanceDeduction: Number(advance) || 0,
          method: form.get("method"),
          paidAt: form.get("paidAt") || undefined,
          notes: String(form.get("notes") || "").trim() || null,
        }),
      });
      toast.success("Salary payment recorded.");
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
      title="Record salary"
      description="This creates a permanent pay record for the staff member."
      wide
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>Cancel</button>
          <button type="submit" form="salary-form" className="btn btn-primary" disabled={pending}>
            {pending ? "Saving…" : "Save payment"}
          </button>
        </>
      }
    >
      {error ? <div className="alert alert-error">{error}</div> : null}
      <form id="salary-form" onSubmit={submit}>
        <div className="form-grid">
          <div className="field span-2">
            <label htmlFor="salary-member">Staff member</label>
            <select id="salary-member" className="select" value={memberId} onChange={(event) => changeMember(event.target.value)} required>
              {members.map((member) => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="salary-start">Period starts</label>
            <input id="salary-start" name="periodStart" type="date" className="input" defaultValue={defaultPeriodStart} required />
          </div>
          <div className="field">
            <label htmlFor="salary-end">Period ends</label>
            <input id="salary-end" name="periodEnd" type="date" className="input" defaultValue={defaultPeriodEnd} required />
          </div>
          <div className="field">
            <label htmlFor="salary-base">Base salary ({currency})</label>
            <input id="salary-base" type="number" min={0} step="0.01" className="input" value={base} onChange={(event) => setBase(event.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="salary-bonus">Bonus ({currency})</label>
            <input id="salary-bonus" type="number" min={0} step="0.01" className="input" value={bonus} onChange={(event) => setBonus(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="salary-deductions">Other deductions ({currency})</label>
            <input id="salary-deductions" type="number" min={0} step="0.01" className="input" value={deductions} onChange={(event) => setDeductions(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="salary-advance">Advance recovery ({currency})</label>
            <input id="salary-advance" type="number" min={0} step="0.01" className="input" value={advance} onChange={(event) => setAdvance(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="salary-method">Paid by</label>
            <select id="salary-method" name="method" className="select" defaultValue="CASH">
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>{PAYMENT_METHOD_LABELS[method]}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="salary-paid">Paid on</label>
            <input id="salary-paid" name="paidAt" type="date" className="input" />
          </div>
          <div className="field span-2">
            <label htmlFor="salary-notes">Note</label>
            <input id="salary-notes" name="notes" className="input" placeholder="Optional note for this payment" />
          </div>
          <div className="field span-2">
            <div className="notice" style={{ margin: 0 }}>
              <Icon name="money" />
              <span>Net pay after bonus and deductions: <strong>{formatMoney(net, currency, locale)}</strong></span>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}
