import type { Metadata } from "next";
import Link from "next/link";
import { listAuditLogs, listSalonOptions } from "@/services/platform";
import { formatDate } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

export default async function PlatformAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; salonId?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const [data, salons] = await Promise.all([
    listAuditLogs({ page, pageSize: 30, q: params.q, salonId: params.salonId }),
    listSalonOptions(),
  ]);

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Audit log</h1>
          <p className="page-subtitle">{data.total} recorded events across every salon and the platform itself.</p>
        </div>
      </div>

      <section className="card">
        <form className="toolbar" method="get">
          <div className="field grow" style={{ maxWidth: 320 }}>
            <label className="field-label" htmlFor="q">Search</label>
            <input id="q" name="q" className="input search" defaultValue={params.q || ""} placeholder="Action, entity, or actor email" />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="salonId">Salon</label>
            <select id="salonId" name="salonId" className="select" defaultValue={params.salonId || ""}>
              <option value="">All salons</option>
              {salons.map((salon) => (
                <option key={salon.id} value={salon.id}>{salon.name}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-secondary">
            <Icon name="filter" /> Apply
          </button>
          {params.q || params.salonId ? (
            <Link href="/platform/audit" className="btn btn-ghost">Clear</Link>
          ) : null}
        </form>

        {data.items.length ? (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th className="hide-mobile">Entity</th>
                    <th>Salon</th>
                    <th className="hide-mobile">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((log) => (
                    <tr key={log.id}>
                      <td>{formatDate(log.createdAt, "UTC", "en-US")}</td>
                      <td>{log.actor}</td>
                      <td><span className="cell-title">{log.action}</span></td>
                      <td className="hide-mobile">{log.entityType}{log.entityId ? ` · ${log.entityId.slice(-6)}` : ""}</td>
                      <td>{log.salon}</td>
                      <td className="hide-mobile">
                        {log.metadata && Object.keys(log.metadata as object).length ? (
                          <code className="meta-code">{JSON.stringify(log.metadata)}</code>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pages={data.pages} total={data.total} basePath="/platform/audit" params={{ q: params.q, salonId: params.salonId }} />
          </>
        ) : (
          <EmptyState
            icon="file"
            title="No audit events"
            message={params.q || params.salonId ? "Try a different search or clear the salon filter." : "Sensitive actions will be recorded here automatically."}
          />
        )}
      </section>
    </div>
  );
}
