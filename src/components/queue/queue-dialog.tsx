"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, clearUrlParam, errorMessage } from "@/lib/client";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { CustomerPicker } from "@/components/forms/customer-picker";
import { Icon } from "@/components/ui/icons";

type Option = { id: string; name: string; active?: boolean; branchId?: string | null };

export function QueueDialog({
  branches,
  services,
  staff,
  autoOpen,
}: {
  branches: Array<{ id: string; name: string; active: boolean }>;
  services: Option[];
  staff: Option[];
  autoOpen?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(Boolean(autoOpen));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  function close() {
    setOpen(false);
    if (autoOpen) clearUrlParam("walkin");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      await apiRequest("/api/queue", {
        method: "POST",
        body: JSON.stringify({
          branchId: form.get("branchId"),
          name: form.get("name"),
          phone: form.get("phone") || undefined,
          customerId: form.get("customerId") || null,
          serviceId: form.get("serviceId") || null,
          staffMembershipId: form.get("staffMembershipId") || null,
          notes: form.get("notes") || undefined,
        }),
      });
      toast.success("Added to the waiting list.");
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
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        <Icon name="plus" /> Add to waiting list
      </button>
      <Modal
        open={open}
        onClose={close}
        title="Add to waiting list"
        description="A waiting number is given automatically."
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={close} disabled={pending}>
              Cancel
            </button>
            <button type="submit" form="queue-form" className="btn btn-primary" disabled={pending}>
              {pending ? "Adding…" : "Add to list"}
            </button>
          </>
        }
      >
        {error ? <div className="alert alert-error">{error}</div> : null}
        <form id="queue-form" onSubmit={submit}>
          <div className="form-grid">
            <div className="field span-2">
              <CustomerPicker required={false} />
            </div>
            <div className="field">
              <label htmlFor="queue-name">Customer name</label>
              <input id="queue-name" name="name" className="input" required placeholder="Name to call" />
            </div>
            <div className="field">
              <label htmlFor="queue-phone">Phone</label>
              <input id="queue-phone" name="phone" type="tel" className="input" placeholder="Optional" />
            </div>
            <div className="field">
              <label htmlFor="queue-branch">Branch</label>
              <select id="queue-branch" name="branchId" className="select" required>
                {branches.filter((branch) => branch.active).map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="queue-service">Service</label>
              <select id="queue-service" name="serviceId" className="select">
                <option value="">Not decided</option>
                {services.filter((service) => service.active !== false).map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="queue-staff">Preferred staff</label>
              <select id="queue-staff" name="staffMembershipId" className="select">
                <option value="">Any available</option>
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field span-2">
              <label htmlFor="queue-notes">Notes</label>
              <textarea id="queue-notes" name="notes" className="textarea" />
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
