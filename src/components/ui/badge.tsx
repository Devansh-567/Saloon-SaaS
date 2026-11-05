const styles: Record<string, string> = {
  ACTIVE: "badge-success",
  PAID: "badge-success",
  COMPLETED: "badge-success",
  ACCEPTED: "badge-success",
  DONE: "badge-success",
  CONFIRMED: "badge-info",
  SCHEDULED: "badge-info",
  CHECKED_IN: "badge-accent",
  IN_PROGRESS: "badge-warning",
  WAITING: "badge-warning",
  CALLED: "badge-accent",
  SERVING: "badge-info",
  PARTIAL: "badge-warning",
  ISSUED: "badge-warning",
  TRIALING: "badge-info",
  PENDING: "badge-warning",
  QUEUED: "badge-info",
  SUSPENDED: "badge-danger",
  CANCELLED: "badge-danger",
  NO_SHOW: "badge-danger",
  VOID: "badge-danger",
  FAILED: "badge-danger",
  PAST_DUE: "badge-danger",
  CANCELED: "badge-danger",
  REFUNDED: "badge-accent",
  SKIPPED: "badge-plain",
  DRAFT: "badge-plain",
};

const plainLabels: Record<string, string> = {
  ISSUED: "Not paid",
  PARTIAL: "Part paid",
  PAID: "Paid",
  VOID: "Cancelled",
  REFUNDED: "Money returned",
  DRAFT: "Draft",
  SCHEDULED: "Booked",
  CHECKED_IN: "Arrived",
  IN_PROGRESS: "In progress",
  NO_SHOW: "Did not come",
  SERVING: "Being served",
  WAITING: "Waiting",
  CALLED: "Called",
};

export function statusLabel(status: string): string {
  const text = plainLabels[status] || status.replaceAll("_", " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const text = label || statusLabel(status);
  return <span className={`badge ${styles[status] || ""}`}>{text.charAt(0).toUpperCase() + text.slice(1)}</span>;
}

export function ActiveBadge({ active }: { active: boolean }) {
  return <span className={`badge ${active ? "badge-success" : "badge-danger"}`}>{active ? "Active" : "Inactive"}</span>;
}
