"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, clearUrlParam, errorMessage } from "@/lib/client";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { Icon } from "@/components/ui/icons";

const CATEGORY_SUGGESTIONS = [
  "Rent",
  "Utilities",
  "Salaries",
  "Commission payout",
  "Supplies",
  "Marketing",
  "Maintenance",
  "Software",
  "Equipment",
  "Other",
];

export function NewExpenseButton({
  branches,
  defaultDate,
  autoOpen,
}: {
  branches: Array<{ id: string; name: string }>;
  defaultDate: string;
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(autoOpen));
  function close() {
    setOpen(false);
    if (autoOpen) clearUrlParam("new");
  }
  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        <Icon name="plus" /> Record expense
      </button>
      {open ? <ExpenseDialog branches={branches} defaultDate={defaultDate} onClose={close} /> : null}
    </>
  );
}

function ExpenseDialog({
  branches,
  defaultDate,
  onClose,
}: {
  branches: Array<{ id: string; name: string }>;
  defaultDate: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [receiptName, setReceiptName] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      let receiptFileId: string | null = null;
      const receipt = form.get("receipt");
      if (receipt instanceof File && receipt.size > 0) {
        const upload = new FormData();
        upload.append("file", receipt);
        const asset = await apiRequest<{ id: string }>("/api/files", { method: "POST", body: upload });
        receiptFileId = asset.id;
      }
      await apiRequest("/api/expenses", {
        method: "POST",
        body: JSON.stringify({
          branchId: form.get("branchId") || null,
          category: form.get("category"),
          vendor: form.get("vendor") || null,
          amount: Number(form.get("amount")),
          spentAt: form.get("spentAt"),
          notes: form.get("notes") || null,
          receiptFileId,
        }),
      });
      toast.success("Expense recorded.");
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
      title="Record expense"
      description="Track salon overheads so reports show a realistic profit."
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>Cancel</button>
          <button type="submit" form="expense-form" className="btn btn-primary" disabled={pending}>
            {pending ? "Saving…" : "Record expense"}
          </button>
        </>
      }
    >
      {error ? <div className="alert alert-error">{error}</div> : null}
      <form id="expense-form" onSubmit={submit}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="expense-category">Category</label>
            <input id="expense-category" name="category" className="input" list="expense-categories" required maxLength={80} autoFocus />
            <datalist id="expense-categories">
              {CATEGORY_SUGGESTIONS.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </div>
          <div className="field">
            <label htmlFor="expense-amount">Amount</label>
            <input id="expense-amount" name="amount" type="number" min={0.01} step="0.01" className="input" required />
          </div>
          <div className="field">
            <label htmlFor="expense-date">Date</label>
            <input id="expense-date" name="spentAt" type="date" className="input" defaultValue={defaultDate} required />
          </div>
          <div className="field">
            <label htmlFor="expense-vendor">Vendor</label>
            <input id="expense-vendor" name="vendor" className="input" maxLength={120} />
          </div>
          {branches.length ? (
            <div className="field span-2">
              <label htmlFor="expense-branch">Branch</label>
              <select id="expense-branch" name="branchId" className="select">
                <option value="">All branches</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="field span-2">
            <label htmlFor="expense-notes">Notes</label>
            <textarea id="expense-notes" name="notes" className="textarea" />
          </div>
          <div className="field span-2">
            <label htmlFor="expense-receipt">Receipt</label>
            <input
              id="expense-receipt"
              name="receipt"
              type="file"
              className="input file-input"
              accept="image/*,application/pdf"
              onChange={(event) => setReceiptName(event.target.files?.[0]?.name || "")}
            />
            <small>{receiptName || "Optional. JPEG, PNG, WebP, or PDF up to the storage limit."}</small>
          </div>
        </div>
      </form>
    </Modal>
  );
}
