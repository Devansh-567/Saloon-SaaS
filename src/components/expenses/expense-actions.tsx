"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, errorMessage } from "@/lib/client";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/modal";
import { Icon } from "@/components/ui/icons";

export function ExpenseActions({ expenseId, label }: { expenseId: string; label: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function voidExpense() {
    setPending(true);
    try {
      await apiRequest(`/api/expenses/${expenseId}`, { method: "DELETE" });
      toast.success("Expense cancelled.");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="actions">
        <button type="button" className="icon-btn" title="Cancel expense" onClick={() => setOpen(true)}>
          <Icon name="ban" />
        </button>
      </div>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={voidExpense}
        title="Cancel this expense?"
        message={`“${label}” will be removed from expense totals but kept in the audit trail.`}
        confirmLabel="Cancel expense"
        danger
        pending={pending}
      />
    </>
  );
}
