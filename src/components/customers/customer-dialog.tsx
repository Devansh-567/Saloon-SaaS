"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, clearUrlParam, errorMessage } from "@/lib/client";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { Icon } from "@/components/ui/icons";

type Customer = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  notes: string | null;
  preferences: string | null;
  tags?: string[];
  birthday?: string | null;
  anniversary?: string | null;
  preferredStaffMembershipId?: string | null;
  marketingOptIn?: boolean;
  source?: string | null;
};

type StaffOption = { id: string; name: string };

export function CustomerDialog({
  customer,
  staff = [],
  triggerLabel,
  variant = "primary",
  icon = "plus",
  autoOpen,
}: {
  customer?: Customer;
  staff?: StaffOption[];
  triggerLabel?: string;
  variant?: "primary" | "secondary" | "ghost";
  icon?: "plus" | "edit";
  autoOpen?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(Boolean(autoOpen));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const editing = Boolean(customer);

  function close() {
    setOpen(false);
    if (autoOpen) clearUrlParam("new");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    const tags = String(form.get("tags") || "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const payload = {
      firstName: form.get("firstName"),
      lastName: form.get("lastName") || "",
      phone: form.get("phone"),
      email: form.get("email") || "",
      notes: form.get("notes") || undefined,
      preferences: form.get("preferences") || null,
      tags,
      birthday: String(form.get("birthday") || "") || null,
      anniversary: String(form.get("anniversary") || "") || null,
      preferredStaffMembershipId: form.get("preferredStaffMembershipId") || null,
      marketingOptIn: form.get("marketingOptIn") === "on",
      source: String(form.get("source") || "").trim() || null,
    };
    try {
      await apiRequest(editing ? `/api/customers/${customer!.id}` : "/api/customers", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      toast.success(editing ? "Customer details updated." : "Customer added.");
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
      <button type="button" className={`btn btn-${variant} ${variant === "ghost" ? "btn-sm" : ""}`} onClick={() => setOpen(true)}>
        <Icon name={icon} />
        {triggerLabel || (editing ? "Edit details" : "Add customer")}
      </button>
      <Modal
        open={open}
        onClose={close}
        title={editing ? "Edit customer" : "Add customer"}
        description={editing ? "Keep contact preferences and notes current." : "Save the customer details for appointments and bills."}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={close} disabled={pending}>
              Cancel
            </button>
            <button type="submit" form="customer-form" className="btn btn-primary" disabled={pending}>
              {pending ? "Saving…" : editing ? "Save changes" : "Add customer"}
            </button>
          </>
        }
      >
        {error ? <div className="alert alert-error">{error}</div> : null}
        <form id="customer-form" onSubmit={submit}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="firstName">First name</label>
              <input id="firstName" name="firstName" className="input" required defaultValue={customer?.firstName} autoFocus />
            </div>
            <div className="field">
              <label htmlFor="lastName">Last name</label>
              <input id="lastName" name="lastName" className="input" defaultValue={customer?.lastName} />
            </div>
            <div className="field">
              <label htmlFor="phone">Phone</label>
              <input id="phone" name="phone" type="tel" className="input" required defaultValue={customer?.phone} placeholder="+1 555 010 2000" />
            </div>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" className="input" defaultValue={customer?.email || ""} />
            </div>
            <div className="field">
              <label htmlFor="birthday">Birthday</label>
              <input id="birthday" name="birthday" type="date" className="input" defaultValue={customer?.birthday || ""} />
            </div>
            <div className="field">
              <label htmlFor="anniversary">Anniversary</label>
              <input id="anniversary" name="anniversary" type="date" className="input" defaultValue={customer?.anniversary || ""} />
            </div>
            <div className="field">
              <label htmlFor="customer-staff">Preferred staff</label>
              <select
                id="customer-staff"
                name="preferredStaffMembershipId"
                className="select"
                defaultValue={customer?.preferredStaffMembershipId || ""}
              >
                <option value="">No preference</option>
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="customer-source">How they found us</label>
              <input id="customer-source" name="source" className="input" defaultValue={customer?.source || ""} placeholder="Came without booking, Instagram, friend" />
            </div>
            <div className="field span-2">
              <label htmlFor="tags">Tags</label>
              <input
                id="tags"
                name="tags"
                className="input"
                defaultValue={(customer?.tags || []).join(", ")}
                placeholder="VIP, colour, bridal — separate with commas"
              />
            </div>
            <div className="field span-2">
              <label htmlFor="preferences">Preferences</label>
              <input id="preferences" name="preferences" className="input" defaultValue={customer?.preferences || ""} placeholder="Styling preferences, sensitivities, or service notes" />
            </div>
            <div className="field span-2">
              <label htmlFor="notes">Private notes</label>
              <textarea id="notes" name="notes" className="textarea" defaultValue={customer?.notes || ""} />
            </div>
            <div className="field span-2">
              <label className="switch">
                <input type="checkbox" name="marketingOptIn" defaultChecked={customer?.marketingOptIn || false} />
                <span>Happy to receive offers and reminders</span>
              </label>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
