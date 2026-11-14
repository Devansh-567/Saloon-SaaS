import type { Metadata } from "next";
import Link from "next/link";
import { requireTenantPage } from "@/lib/guards";
import { hasPermission } from "@/lib/auth";
import { listQueue } from "@/services/queue";
import { getSalonSettingsData } from "@/services/salon-config";
import { parseSalonSettings } from "@/lib/settings";
import { formatTime } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { QueueDialog } from "@/components/queue/queue-dialog";
import { QueueActions } from "@/components/queue/queue-actions";
import { Icon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Waiting List" };
export const dynamic = "force-dynamic";

export default async function QueuePage({ searchParams }: { searchParams: Promise<{ branch?: string; walkin?: string }> }) {
  const context = await requireTenantPage("queue.read");
  const params = await searchParams;
  const [settings, queue] = await Promise.all([
    getSalonSettingsData(context),
    listQueue(context, params.branch || context.branch?.id || null),
  ]);
  const canWrite = hasPermission(context, "queue.write");
  const walkInsEnabled = parseSalonSettings(context.salon.settings).allowWalkIns;
  const grouped = {
    WAITING: queue.filter((ticket) => ticket.status === "WAITING"),
    CALLED: queue.filter((ticket) => ticket.status === "CALLED"),
    SERVING: queue.filter((ticket) => ticket.status === "SERVING"),
  };

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Waiting List</h1>
          <p className="page-subtitle">Move customers from waiting to called to service without losing the order.</p>
        </div>
        <div className="page-actions">
          {canWrite && walkInsEnabled ? (
            <QueueDialog branches={settings.branches} services={settings.services} staff={settings.staff} autoOpen={params.walkin === "1"} />
          ) : null}
        </div>
      </div>

      {!walkInsEnabled ? (
        <div className="alert alert-warning">
          The waiting list is switched off. Turn it on in Settings to add waiting customers.
        </div>
      ) : null}

      <div className="grid-4">
        {(["WAITING", "CALLED", "SERVING"] as const).map((status) => (
          <div className="stat-card" key={status}>
            <div className="stat-top">
              <span>{status.charAt(0) + status.slice(1).toLowerCase()}</span>
              <Icon name={status === "WAITING" ? "clock" : status === "CALLED" ? "phone" : "play"} />
            </div>
            <div className="stat-value">{grouped[status].length}</div>
            <div className="stat-foot">
              {status === "WAITING" ? "Customers waiting" : status === "CALLED" ? "Ready to begin" : "Currently in service"}
            </div>
          </div>
        ))}
        <div className="stat-card">
          <div className="stat-top">
            <span>Customers waiting</span>
            <Icon name="ticket" />
          </div>
          <div className="stat-value">{queue.length}</div>
          <div className="stat-foot">Across the selected branch</div>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>Waiting now</h2>
            <p>Today&apos;s customers, first come first served.</p>
          </div>
          <form method="get" className="filter-bar">
            <div className="field">
              <label htmlFor="branch" className="field-label">Branch</label>
              <select id="branch" name="branch" className="select" defaultValue={params.branch || context.branch?.id || ""}>
                <option value="">All branches</option>
                {settings.branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn btn-secondary btn-sm">Apply</button>
          </form>
        </div>

        {queue.length ? (
          <div className="card-body">
            <div className="grid-3">
              {queue.map((ticket) => (
                <article key={ticket.id} className="card" style={{ boxShadow: "none", background: ticket.status === "CALLED" ? "var(--accent-soft)" : "var(--surface)" }}>
                  <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                      <div>
                        <div style={{ fontFamily: "var(--font-display)", fontSize: 32, lineHeight: 1 }}>#{ticket.queueNumber}</div>
                        <div style={{ fontWeight: 650, fontSize: 13, marginTop: 7 }}>{ticket.name}</div>
                        <div style={{ color: "var(--muted)", fontSize: 11.5 }}>
                          {ticket.phone || "No phone"} · joined {formatTime(ticket.createdAt, context.salon.timezone, context.salon.locale)}
                        </div>
                      </div>
                      <StatusBadge status={ticket.status} />
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-soft)", display: "grid", gap: 3 }}>
                      <span>{ticket.service || "Service not selected"}</span>
                      <span>{ticket.staff || "Any available staff"} · {ticket.branch}</span>
                      {ticket.notes ? <span style={{ color: "var(--muted)" }}>{ticket.notes}</span> : null}
                    </div>
                    <div style={{ marginTop: "auto" }}>
                      {canWrite ? <QueueActions id={ticket.id} status={ticket.status} /> : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState
            icon="ticket"
            title="Nobody is waiting"
            message="No one is waiting right now. Add a customer when someone walks in."
            action={canWrite && walkInsEnabled ? <QueueDialog branches={settings.branches} services={settings.services} staff={settings.staff} /> : null}
          />
        )}
      </section>

      <div style={{ display: "flex", gap: 9, justifyContent: "flex-end" }}>
        <Link href="/appointments" className="btn btn-ghost btn-sm">
          Open appointments <Icon name="arrow" />
        </Link>
      </div>
    </div>
  );
}
