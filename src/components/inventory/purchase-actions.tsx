"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, errorMessage } from "@/lib/client";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/modal";
import { Icon } from "@/components/ui/icons";

export function PurchaseActions({
  id,
  reference,
  total,
}: {
  id: string;
  reference: string;
  total: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function remove() {
    setPending(true);
    try {
      await apiRequest(`/api/inventory/purchases/${id}`, { method: "DELETE" });
      toast.success("Entry removed and stock corrected.");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" className="icon-btn" title="Delete purchase" onClick={() => setOpen(true)}>
        <Icon name="trash" />
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={remove}
        title="Delete purchase?"
        message={`${reference} (${total}) will be removed and the stock it added will be taken back out. This is blocked if that stock was already sold or used.`}
        confirmLabel="Delete purchase"
        danger
        pending={pending}
      />
    </>
  );
}
