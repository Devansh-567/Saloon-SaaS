"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, errorMessage } from "@/lib/client";
import { EMPLOYMENT_TYPES, EMPLOYMENT_TYPE_LABELS } from "@/lib/hr";
import { formatMoney } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { Icon } from "@/components/ui/icons";

type Member = {
  id: string;
  name: string;
  role: string;
  email: string;
  profile: {
    jobTitle: string | null;
    employmentType: string;
    hiredAt: string | null;
    monthlySalary: number;
    payDay: number;
    address: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    aadhaarMasked: string | null;
    panMasked: string | null;
    hasAadhaar: boolean;
    hasPan: boolean;
    onboardingComplete: boolean;
  };
};

export function EmployeeDialog({
  member,
  currency,
  locale,
  label = "Work details",
  variant = "secondary",
}: {
  member: Member;
  currency: string;
  locale: string;
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [clearAadhaar, setClearAadhaar] = useState(false);
  const [clearPan, setClearPan] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    const aadhaar = String(form.get("aadhaarNumber") || "").trim();
    const pan = String(form.get("panNumber") || "").trim();
    const salary = String(form.get("monthlySalary") || "").trim();
    const payload: Record<string, unknown> = {
      jobTitle: String(form.get("jobTitle") || "").trim() || null,
      employmentType: form.get("employmentType"),
      hiredAt: String(form.get("hiredAt") || "") || null,
      monthlySalary: salary === "" ? null : Number(salary),
      payDay: Number(form.get("payDay")) || 1,
      address: String(form.get("address") || "").trim() || null,
      emergencyContactName: String(form.get("emergencyContactName") || "").trim() || null,
      emergencyContactPhone: String(form.get("emergencyContactPhone") || "").trim() || null,
      onboardingComplete: form.get("onboardingComplete") === "on",
    };
    if (clearAadhaar) payload.aadhaarNumber = null;
    else if (aadhaar) payload.aadhaarNumber = aadhaar;
    if (clearPan) payload.panNumber = null;
    else if (pan) payload.panNumber = pan;
    try {
      await apiRequest(`/api/hr/employees/${member.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      toast.success("Staff record updated.");
      setOpen(false);
      setClearAadhaar(false);
      setClearPan(false);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" className={`btn btn-${variant} ${variant === "ghost" ? "btn-sm" : ""}`} onClick={() => setOpen(true)}>
        <Icon name="edit" /> {label}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Work details · ${member.name}`}
        description="These details stay private to the owner and managers you allow."
        wide
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </button>
            <button type="submit" form="employee-form" className="btn btn-primary" disabled={pending}>
              {pending ? "Saving…" : "Save details"}
            </button>
          </>
        }
      >
        {error ? <div className="alert alert-error">{error}</div> : null}
        <form id="employee-form" onSubmit={submit}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="employee-job">Job title</label>
              <input id="employee-job" name="jobTitle" className="input" defaultValue={member.profile.jobTitle || ""} placeholder="Senior stylist" />
            </div>
            <div className="field">
              <label htmlFor="employee-type">Employment</label>
              <select id="employee-type" name="employmentType" className="select" defaultValue={member.profile.employmentType}>
                {EMPLOYMENT_TYPES.map((type) => (
                  <option key={type} value={type}>{EMPLOYMENT_TYPE_LABELS[type]}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="employee-hired">Joined on</label>
              <input id="employee-hired" name="hiredAt" type="date" className="input" defaultValue={member.profile.hiredAt || ""} />
            </div>
            <div className="field">
              <label htmlFor="employee-salary">Monthly salary ({currency})</label>
              <input
                id="employee-salary"
                name="monthlySalary"
                type="number"
                min={0}
                step="0.01"
                className="input"
                defaultValue={member.profile.monthlySalary || ""}
                placeholder={formatMoney(0, currency, locale)}
              />
            </div>
            <div className="field">
              <label htmlFor="employee-payday">Pay day</label>
              <select id="employee-payday" name="payDay" className="select" defaultValue={String(member.profile.payDay)}>
                {Array.from({ length: 28 }, (_, index) => index + 1).map((day) => (
                  <option key={day} value={day}>Day {day}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="employee-phone-contact">Emergency phone</label>
              <input id="employee-phone-contact" name="emergencyContactPhone" type="tel" className="input" defaultValue={member.profile.emergencyContactPhone || ""} />
            </div>
            <div className="field">
              <label htmlFor="employee-contact">Emergency contact</label>
              <input id="employee-contact" name="emergencyContactName" className="input" defaultValue={member.profile.emergencyContactName || ""} />
            </div>
            <div className="field span-2">
              <label htmlFor="employee-address">Address</label>
              <textarea id="employee-address" name="address" className="textarea" rows={2} defaultValue={member.profile.address || ""} />
            </div>
            <div className="field">
              <label htmlFor="employee-aadhaar">Aadhaar number</label>
              <input
                id="employee-aadhaar"
                name="aadhaarNumber"
                className="input"
                inputMode="numeric"
                autoComplete="off"
                placeholder={member.profile.aadhaarMasked || "12 digit number"}
                disabled={clearAadhaar}
              />
              {member.profile.hasAadhaar ? (
                <label className="switch" style={{ marginTop: 6 }}>
                  <input type="checkbox" checked={clearAadhaar} onChange={(event) => setClearAadhaar(event.target.checked)} />
                  <span>Remove saved Aadhaar</span>
                </label>
              ) : null}
            </div>
            <div className="field">
              <label htmlFor="employee-pan">PAN number</label>
              <input
                id="employee-pan"
                name="panNumber"
                className="input"
                autoComplete="off"
                placeholder={member.profile.panMasked || "10 character PAN"}
                disabled={clearPan}
              />
              {member.profile.hasPan ? (
                <label className="switch" style={{ marginTop: 6 }}>
                  <input type="checkbox" checked={clearPan} onChange={(event) => setClearPan(event.target.checked)} />
                  <span>Remove saved PAN</span>
                </label>
              ) : null}
            </div>
            <div className="field span-2">
              <label className="switch">
                <input type="checkbox" name="onboardingComplete" defaultChecked={member.profile.onboardingComplete} />
                <span>Onboarding complete — documents and details are in place</span>
              </label>
            </div>
          </div>
          <p className="hint" style={{ marginTop: 12 }}>
            Aadhaar and PAN are encrypted and shown masked after saving.
          </p>
        </form>
      </Modal>
    </>
  );
}
