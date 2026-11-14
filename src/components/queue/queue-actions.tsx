"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, errorMessage } from "@/lib/client";
import { useToast } from "@/components/ui/toast";

const flow: Record<string, Array<{ status: string; label: string; danger?: boolean }>> = {
  WAITING: [
    { status: "CALLED", label: "Call" },
    { status: "CANCELLED", label: "Cancel", danger: true },
  ],
  CALLED: [
    { status: "SERVING", label: "Start service" },
    { status: "CANCELLED", label: "Cancel", danger: true },
  ],
  SERVING: [
    { status: "DONE", label: "Finish" },
    { status: "CANCELLED", label: "Cancel", danger: true },
  ],
};

export function QueueActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState("");

  async function update(next: string) {
    setPending(next);
    try {
      await apiRequest(`/api/queue/${id}`, { method: "PATCH", body: JSON.stringify({ status: next }) });
      toast.success(`Customer marked as ${next.toLowerCase()}.`);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending("");
    }
  }

  return (
    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
      {(flow[status] || []).map((action) => (
        <button
          key={action.status}
          type="button"
          className={`btn btn-sm ${action.danger ? "btn-soft-danger" : action.status === "DONE" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => update(action.status)}
          disabled={Boolean(pending)}
        >
          {pending === action.status ? "…" : action.label}
        </button>
      ))}
    </div>
  );
}
