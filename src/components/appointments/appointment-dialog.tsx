"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, clearUrlParam, errorMessage } from "@/lib/client";
import { zonedDateTimeToUtc, zonedLocalInput } from "@/lib/timezone";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { CustomerPicker } from "@/components/forms/customer-picker";
import { Icon } from "@/components/ui/icons";

type Service = { id: string; name: string; price: number; durationMin: number; active: boolean };
type Staff = { id: string; name: string; branchId: string | null };
type Branch = { id: string; name: string; active: boolean };
type Customer = { id: string; name: string; phone: string; email: string | null };

type Appointment = {
  id: string;
  customer: Customer;
  service: { id: string };
  staff: { id: string };
  branch: { id: string };
  startAt: string;
  notes: string | null;
  walkIn: boolean;
};

export function AppointmentDialog({
  services,
  staff,
  branches,
  initialCustomer,
  defaultDate,
  timezone,
  appointment,
  autoOpen,
}: {
  services: Service[];
  staff: Staff[];
  branches: Branch[];
  initialCustomer?: Customer | null;
  defaultDate: string;
  timezone: string;
  appointment?: Appointment;
  autoOpen?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(Boolean(autoOpen));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [branchId, setBranchId] = useState(appointment?.branch.id || branches.find((branch) => branch.active)?.id || "");
  const editing = Boolean(appointment);
  const filteredStaff = staff.filter((member) => !branchId || !member.branchId || member.branchId === branchId);
  const activeServices = services.filter((service) => service.active || service.id === appointment?.service.id);
  const defaultStart = appointment ? zonedLocalInput(new Date(appointment.startAt), timezone) : `${defaultDate}T09:00`;

  function close() {
    setOpen(false);
    if (autoOpen) clearUrlParam("new");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      const body = {
        branchId: form.get("branchId"),
        customerId: form.get("customerId"),
        serviceId: form.get("serviceId"),
        staffMembershipId: form.get("staffMembershipId"),
        startAt: zonedDateTimeToUtc(String(form.get("startAt")), timezone).toISOString(),
        notes: form.get("notes") || undefined,
        ...(editing ? {} : { walkIn: form.get("walkIn") === "on" }),
      };
      await apiRequest(editing ? `/api/appointments/${appointment!.id}` : "/api/appointments", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      toast.success(editing ? "Appointment updated." : "Appointment booked.");
      close();
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={`btn ${editing ? "btn-ghost btn-sm" : "btn-primary"}`}
        onClick={() => setOpen(true)}
      >
        <Icon name={editing ? "edit" : "plus"} />
        {editing ? "Reschedule" : "Book appointment"}
      </button>
      <Modal
        open={open}
        onClose={close}
        title={editing ? "Reschedule appointment" : "Book appointment"}
        description="The assigned staff member cannot have overlapping active appointments."
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={close} disabled={pending}>
              Cancel
            </button>
            <button type="submit" form="appointment-form" className="btn btn-primary" disabled={pending}>
              {pending ? "Saving…" : editing ? "Save changes" : "Book appointment"}
            </button>
          </>
        }
      >
        {error ? <div className="alert alert-error">{error}</div> : null}
        <form id="appointment-form" onSubmit={submit}>
          <div className="form-grid">
            <div className="span-2">
              {editing ? (
                <div className="field">
                  <label>Customer</label>
                  <input className="input" value={`${appointment!.customer.name} · ${appointment!.customer.phone}`} disabled />
                  <input type="hidden" name="customerId" value={appointment!.customer.id} />
                </div>
              ) : (
                <CustomerPicker initial={initialCustomer} />
              )}
            </div>
            <div className="field">
              <label htmlFor="branchId">Branch</label>
              <select id="branchId" name="branchId" className="select" value={branchId} onChange={(event) => setBranchId(event.target.value)} required>
                {branches.filter((branch) => branch.active || branch.id === appointment?.branch.id).map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="serviceId">Service</label>
              <select id="serviceId" name="serviceId" className="select" defaultValue={appointment?.service.id} required>
                <option value="">Choose a service</option>
                {activeServices.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} · {service.durationMin} min
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="staffMembershipId">Staff member</label>
              <select id="staffMembershipId" name="staffMembershipId" className="select" defaultValue={appointment?.staff.id} required>
                <option value="">Choose a staff member</option>
                {filteredStaff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="startAt">Start date & time</label>
              <input id="startAt" name="startAt" type="datetime-local" className="input" defaultValue={defaultStart} required />
              <small>Times are shown in {timezone.replaceAll("_", " ")}.</small>
            </div>
            <div className="field span-2">
              <label htmlFor="notes">Appointment notes</label>
              <textarea id="notes" name="notes" className="textarea" defaultValue={appointment?.notes || ""} />
            </div>
            {!editing ? (
              <label className="check-row span-2">
                <input type="checkbox" name="walkIn" defaultChecked={false} />
                Customer came without booking
              </label>
            ) : null}
          </div>
        </form>
      </Modal>
    </>
  );
}
