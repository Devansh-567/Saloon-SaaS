import type { Metadata } from "next";
import Link from "next/link";
import { requireTenantPage } from "@/lib/guards";
import { AUDIT_CATEGORIES, auditCategoryLabel, getAuditSummary, listAuditLogs } from "@/services/audit";
import { formatDate } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Activity log" };
export const dynamic = "force-dynamic";

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireTenantPage("audit.read");
  const params = await searchParams;
  const single = (key: string) => (Array.isArray(params[key]) ? params[key]?.[0] : params[key]);
  const page = Math.max(1, Number(single("page")) || 1);
  const filters = {
    category: single("category"),
    actorId: single("actorId"),
    q: single("q"),
    from: single("from"),
    to: single("to"),
  };
  const [data, summary] = await Promise.all([
    listAuditLogs(context, { page, pageSize: 30, ...filters }),
    getAuditSummary(context),
  ]);

  const hasFilters = Boolean(filters.category || filters.actorId || filters.q || filters.from || filters.to);

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Activity log</h1>
          <p className="page-subtitle">
            A plain record of important changes: bookings, money, stock, staff, and access.
          </p>
        </div>
      </div>

      <div className="grid-3">
        <div className="stat-card">
          <div className="stat-top"><span>Events today</span><Icon name="eye" /></div>
          <div className="stat-value">{summary.today}</div>
          <div className="stat-foot">Recorded automatically</div>
        </div>
        <div className="stat-card">
          <div className="stat-top"><span>Events this week</span><Icon name="chart" /></div>
          <div className="stat-value">{summary.week}</div>
          <div className="stat-foot">Last seven days</div>
        </div>
        <div className="stat-card">
          <div className="stat-top"><span>Events this month</span><Icon name="calendar" /></div>
          <div className="stat-value">{summary.month}</div>
          <div className="stat-foot">Last 30 days</div>
        </div>
      </div>

      {summary.categories.length ? (
        <div className="chip-row">
          <Link href="/activity" className={`chip ${!filters.category ? "" : "muted"}`}>All</Link>
          {summary.categories.map((category) => (
            <Link
              key={category.id}
              href={`/activity?category=${category.id}`}
              className={`chip ${filters.category === category.id ? "" : "muted"}`}
            >
              {category.label} · {category.count}
            </Link>
          ))}
        </div>
      ) : null}

      <section className="card">
        <form className="toolbar" method="get">
          <div className="field grow" style={{ maxWidth: 300 }}>
            <label className="field-label" htmlFor="q">Search</label>
            <input id="q" name="q" className="input search" defaultValue={filters.q || ""} placeholder="Action, member, or customer" />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="category">Category</label>
            <select id="category" name="category" className="select" defaultValue={filters.category || ""}>
              <option value="">All categories</option>
              {AUDIT_CATEGORIES.map((category) => (
                <option key={category.id} value={category.id}>{category.label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="actorId">By person</label>
            <select id="actorId" name="actorId" className="select" defaultValue={filters.actorId || ""}>
              <option value="">Anyone</option>
              {data.actors.map((actor) => (
                <option key={actor.id} value={actor.id}>{actor.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="from">From</label>
            <input id="from" name="from" type="date" className="input" defaultValue={filters.from || ""} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="to">To</label>
            <input id="to" name="to" type="date" className="input" defaultValue={filters.to || ""} />
          </div>
          <button type="submit" className="btn btn-secondary">
            <Icon name="filter" /> Apply
          </button>
          {hasFilters ? <Link href="/activity" className="btn btn-ghost">Clear</Link> : null}
        </form>

        {data.items.length ? (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Who</th>
                    <th>What happened</th>
                    <th className="hide-mobile">Area</th>
                    <th className="hide-mobile">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item.id}>
                      <td className="nowrap">{formatDate(item.createdAt, context.salon.timezone, context.salon.locale)}</td>
                      <td>
                        <span className="cell-title">{item.actor?.name || "System"}</span>
                        {item.ip ? <span className="cell-sub">{item.ip}</span> : null}
                      </td>
                      <td>
                        <span className="cell-title">{item.actionLabel}</span>
                        <span className="cell-sub">{item.entityType}{item.entityId ? ` · ${item.entityId.slice(-6)}` : ""}</span>
                      </td>
                      <td className="hide-mobile">
                        <span className="badge badge-plain">{item.categoryLabel || auditCategoryLabel(item.category)}</span>
                      </td>
                      <td className="hide-mobile">
                        {item.metadata && typeof item.metadata === "object" && Object.keys(item.metadata).length ? (
                          <code className="meta-code">{JSON.stringify(item.metadata)}</code>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              pages={data.pages}
              total={data.total}
              basePath="/activity"
              params={{
                category: filters.category,
                actorId: filters.actorId,
                q: filters.q,
                from: filters.from,
                to: filters.to,
              }}
            />
          </>
        ) : (
          <EmptyState
            icon="eye"
            title="Nothing recorded"
            message={hasFilters ? "Try another person, category, or date range." : "Important changes will appear here as your team works."}
          />
        )}
      </section>
    </div>
  );
}
