"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, errorMessage } from "@/lib/client";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/modal";

const actions: Record<string, Array<{ status: string; label: string; tone?: "danger" }>> = {
  SCHEDULED: [
    { status: "CONFIRMED", label: "Confirm" },
    { status: "CHECKED_IN", label: "Check in" },
    { status: "CANCELLED", label: "Cancel", tone: "danger" },
    { status: "NO_SHOW", label: "No show", tone: "danger" },
  ],
  CONFIRMED: [
    { status: "CHECKED_IN", label: "Check in" },
    { status: "IN_PROGRESS", label: "Start" },
    { status: "CANCELLED", label: "Cancel", tone: "danger" },
    { status: "NO_SHOW", label: "No show", tone: "danger" },
  ],
  CHECKED_IN: [
    { status: "IN_PROGRESS", label: "Start" },
    { status: "COMPLETED", label: "Complete" },
    { status: "CANCELLED", label: "Cancel", tone: "danger" },
  ],
  IN_PROGRESS: [
    { status: "COMPLETED", label: "Complete" },
    { status: "CANCELLED", label: "Cancel", tone: "danger" },
  ],
};

export function AppointmentActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState("");
  const [confirm, setConfirm] = useState<{ status: string; label: string } | null>(null);
  const available = actions[status] || [];

  async function changeStatus(next: string) {
    setPending(next);
    try {
      await apiRequest(`/api/appointments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      toast.success(next === "COMPLETED" ? "Appointment completed." : `Appointment marked ${next.toLowerCase().replaceAll("_", " ")}.`);
      setConfirm(null);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending("");
    }
  }

  if (!available.length) return <span className="hint">Closed</span>;

  return (
    <>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {available.map((action) => (
          <button
            key={action.status}
            type="button"
            className={`btn btn-sm ${action.tone === "danger" ? "btn-soft-danger" : action.status === "COMPLETED" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => (action.tone === "danger" || action.status === "COMPLETED" ? setConfirm(action) : changeStatus(action.status))}
            disabled={Boolean(pending)}
          >
            {pending === action.status ? "…" : action.label}
          </button>
        ))}
      </div>
      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && changeStatus(confirm.status)}
        title={confirm?.label || "Update appointment"}
        message={
          confirm?.status === "COMPLETED"
            ? "Completing this appointment records the visit and consumes any linked service product usage. This cannot be undone."
            : "This changes the appointment status. Continue?"
        }
        confirmLabel={confirm?.label}
        danger={confirm?.status !== "COMPLETED"}
        pending={Boolean(pending)}
      />
    </>
  );
}
