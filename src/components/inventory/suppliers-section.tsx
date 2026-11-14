"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, errorMessage } from "@/lib/client";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icons";

type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
};

export function SuppliersSection({ suppliers, canWrite }: { suppliers: Supplier[]; canWrite: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState<Supplier | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  async function remove() {
    if (!deleting) return;
    setDeletePending(true);
    try {
      const result = await apiRequest<{ archived: boolean }>(`/api/inventory/suppliers/${deleting.id}`, { method: "DELETE" });
      toast.success(result.archived ? "Supplier archived because purchases or products still use it." : "Supplier deleted.");
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
            <h2>Suppliers</h2>
            <p>Vendors you purchase retail and back-bar stock from.</p>
          </div>
          {canWrite ? (
            <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
              <Icon name="plus" /> New supplier
            </button>
          ) : null}
        </div>
        {suppliers.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Phone</th>
                  <th className="hide-mobile">Email</th>
                  <th className="hide-mobile">Address</th>
                  <th>Status</th>
                  {canWrite ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => (
                  <tr key={supplier.id}>
                    <td>
                      <div className="cell-title">{supplier.name}</div>
                      {supplier.notes ? <div className="cell-sub">{supplier.notes}</div> : null}
                    </td>
                    <td>{supplier.phone || "—"}</td>
                    <td className="hide-mobile">{supplier.email || "—"}</td>
                    <td className="hide-mobile">{supplier.address || "—"}</td>
                    <td>
                      <span className={`badge ${supplier.active ? "badge-success" : "badge-muted"}`}>
                        {supplier.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    {canWrite ? (
                      <td>
                        <div className="actions">
                          <button type="button" className="icon-btn" title="Edit supplier" onClick={() => setEditing(supplier)}>
                            <Icon name="edit" />
                          </button>
                          <button type="button" className="icon-btn" title="Delete or archive supplier" onClick={() => setDeleting(supplier)}>
                            <Icon name="trash" />
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon="building"
            title="No suppliers yet"
            message="Add the vendors you buy products from to link purchases and costs."
            action={canWrite ? <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>Add supplier</button> : null}
          />
        )}
      </section>
      {open ? <SupplierDialog onClose={() => setOpen(false)} /> : null}
      {editing ? <SupplierDialog supplier={editing} onClose={() => setEditing(null)} /> : null}
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title="Delete supplier?"
        message={deleting ? `“${deleting.name}” will be removed. If purchases or products still point to this supplier, it is archived instead.` : ""}
        confirmLabel="Delete"
        danger
        pending={deletePending}
      />
    </>
  );
}

function SupplierDialog({ supplier, onClose }: { supplier?: Supplier; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState(supplier?.active ?? true);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      await apiRequest(supplier ? `/api/inventory/suppliers/${supplier.id}` : "/api/inventory/suppliers", {
        method: supplier ? "PATCH" : "POST",
        body: JSON.stringify({
          name: form.get("name"),
          phone: form.get("phone") || null,
          email: form.get("email") || null,
          address: form.get("address") || null,
          notes: form.get("notes") || null,
          active,
        }),
      });
      toast.success(supplier ? "Supplier updated." : "Supplier added.");
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
      title={supplier ? "Edit supplier" : "New supplier"}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>Cancel</button>
          <button type="submit" form="supplier-form" className="btn btn-primary" disabled={pending}>
            {pending ? "Saving…" : supplier ? "Save changes" : "Add supplier"}
          </button>
        </>
      }
    >
      {error ? <div className="alert alert-error">{error}</div> : null}
      <form id="supplier-form" onSubmit={submit}>
        <div className="form-grid">
          <div className="field span-2">
            <label htmlFor="supplier-name">Name</label>
            <input id="supplier-name" name="name" className="input" defaultValue={supplier?.name || ""} required maxLength={120} autoFocus />
          </div>
          <div className="field">
            <label htmlFor="supplier-phone">Phone</label>
            <input id="supplier-phone" name="phone" className="input" defaultValue={supplier?.phone || ""} maxLength={30} />
          </div>
          <div className="field">
            <label htmlFor="supplier-email">Email</label>
            <input id="supplier-email" name="email" type="email" className="input" defaultValue={supplier?.email || ""} />
          </div>
          <div className="field span-2">
            <label htmlFor="supplier-address">Address</label>
            <input id="supplier-address" name="address" className="input" defaultValue={supplier?.address || ""} maxLength={500} />
          </div>
          <div className="field span-2">
            <label htmlFor="supplier-notes">Notes</label>
            <textarea id="supplier-notes" name="notes" className="textarea" defaultValue={supplier?.notes || ""} />
          </div>
          <div className="field span-2">
            <label className="switch">
              <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
              <span>{active ? "Active — can be linked to products and purchases" : "Inactive — keep for history only"}</span>
            </label>
          </div>
        </div>
      </form>
    </Modal>
  );
}
