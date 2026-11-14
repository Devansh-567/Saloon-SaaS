import type { Metadata } from "next";
import Link from "next/link";
import { listNotificationLogs, listTemplates } from "@/services/platform";
import { formatDate } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty";
import { StatusBadge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icons";
import { TemplatesPanel } from "@/components/platform/templates-panel";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

const STATUSES = ["ACCEPTED", "SKIPPED", "FAILED"];

export default async function PlatformNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const tab = params.tab === "logs" ? "logs" : "templates";
  const page = Math.max(1, Number(params.page) || 1);
  const status = STATUSES.includes(params.status || "") ? params.status : undefined;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Notifications</h1>
          <p className="page-subtitle">
            Templates and delivery logs. “Accepted” means the provider took the message — it is not proof of delivery.
          </p>
        </div>
      </div>

      <div className="tabs">
        <Link href="/platform/notifications" className={`tab ${tab === "templates" ? "active" : ""}`}>
          Templates
        </Link>
        <Link href="/platform/notifications?tab=logs" className={`tab ${tab === "logs" ? "active" : ""}`}>
          Delivery log
        </Link>
      </div>

      {tab === "templates" ? <TemplatesTab /> : <LogsTab status={status} page={page} />}
    </div>
  );
}

async function TemplatesTab() {
  const templates = await listTemplates();
  return (
    <TemplatesPanel
      templates={templates.map((template) => ({
        id: template.id,
        key: template.key,
        channel: template.channel,
        subject: template.subject,
        body: template.body,
        enabled: template.enabled,
      }))}
    />
  );
}

async function LogsTab({ status, page }: { status?: string; page: number }) {
  const data = await listNotificationLogs({ page, pageSize: 25, status });

  return (
    <section className="card">
      <form className="toolbar" method="get">
        <input type="hidden" name="tab" value="logs" />
        <div className="field">
          <label className="field-label" htmlFor="status">Status</label>
          <select id="status" name="status" className="select" defaultValue={status || ""}>
            <option value="">All statuses</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>{value.toLowerCase()}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-secondary">
          <Icon name="filter" /> Apply
        </button>
        {status ? (
          <Link href="/platform/notifications?tab=logs" className="btn btn-ghost">Clear</Link>
        ) : null}
      </form>

      {data.items.length ? (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Channel</th>
                  <th>Template</th>
                  <th className="hide-mobile">Recipient</th>
                  <th>Salon</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDate(log.createdAt, "UTC", "en-US")}</td>
                    <td><span className="badge badge-plain">{log.channel.toLowerCase()}</span></td>
                    <td>{log.templateKey}</td>
                    <td className="hide-mobile">{log.recipient}</td>
                    <td>{log.salon}</td>
                    <td>
                      <StatusBadge status={log.status} />
                      {log.error ? <div className="cell-sub text-danger">{log.error}</div> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pages={data.pages} total={data.total} basePath="/platform/notifications" params={{ tab: "logs", status }} />
        </>
      ) : (
        <EmptyState
          icon="send"
          title="No notifications logged"
          message="Invoice emails, SMS, and WhatsApp messages appear here once sending is attempted."
        />
      )}
    </section>
  );
}
