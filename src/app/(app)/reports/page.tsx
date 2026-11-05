import type { Metadata } from "next";
import Link from "next/link";
import { requireTenantPage } from "@/lib/guards";
import { getReports } from "@/services/analytics";
import { zonedDateInput, zonedDayBounds, zonedStartOfDay } from "@/lib/timezone";
import { formatMoney, paymentMethodLabel } from "@/lib/utils";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { EmptyState } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

const RANGES = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "mtd", label: "This month" },
  { id: "last", label: "Last month" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
  { id: "custom", label: "Custom" },
] as const;

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const context = await requireTenantPage("reports.read");
  const params = await searchParams;
  const range = RANGES.some((item) => item.id === params.range) ? params.range! : "30d";
  const today = zonedDateInput(new Date(), context.salon.timezone);
  const monthStart = `${today.slice(0, 8)}01`;

  let fromDate = shiftDate(today, -29);
  let toDate = today;
  if (range === "today") fromDate = today;
  else if (range === "week") {
    const weekday = new Date(`${today}T12:00:00.000Z`).getUTCDay();
    fromDate = shiftDate(today, -((weekday + 6) % 7));
  } else if (range === "7d") fromDate = shiftDate(today, -6);
  else if (range === "90d") fromDate = shiftDate(today, -89);
  else if (range === "mtd") fromDate = monthStart;
  else if (range === "last") {
    const previousMonthEnd = shiftDate(monthStart, -1);
    fromDate = `${previousMonthEnd.slice(0, 8)}01`;
    toDate = previousMonthEnd;
  } else if (range === "custom") {
    if (params.from && /^\d{4}-\d{2}-\d{2}$/.test(params.from)) fromDate = params.from;
    if (params.to && /^\d{4}-\d{2}-\d{2}$/.test(params.to)) toDate = params.to;
  }

  const from = zonedStartOfDay(fromDate, context.salon.timezone);
  const to = zonedDayBounds(toDate, context.salon.timezone).to;
  const report = await getReports(context, from, to);
  const { summary } = report;
  const currency = context.salon.currency;
  const locale = context.salon.locale;

  const dayFormatter = (date: string) => date.slice(5);

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Reports</h1>
          <p className="page-subtitle">
            {fromDate} to {toDate} · {context.salon.timezone.replaceAll("_", " ")}
          </p>
        </div>
      </div>

      <section className="card">
        <form className="toolbar" method="get">
          <div className="field">
            <label className="field-label" htmlFor="range">Period</label>
            <select id="range" name="range" className="select" defaultValue={range}>
              {RANGES.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="from">From</label>
            <input id="from" name="from" type="date" className="input" defaultValue={fromDate} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="to">To</label>
            <input id="to" name="to" type="date" className="input" defaultValue={toDate} />
          </div>
          <button type="submit" className="btn btn-secondary">
            <Icon name="filter" /> Apply
          </button>
        </form>
      </section>

      <div className="grid-4">
        <Stat label="Service sales" value={formatMoney(summary.sales, currency, locale)} hint={`${summary.invoiceCount} bills`} />
        <Stat label="Collected" value={formatMoney(summary.collected, currency, locale)} hint={`${formatMoney(summary.refunds, currency, locale)} given back`} />
        <Stat label="Expenses" value={formatMoney(summary.expenses, currency, locale)} hint="Recorded overheads" />
        <Stat label="Profit estimate" value={formatMoney(summary.profitEstimate, currency, locale)} hint="Sales minus expenses" />
      </div>
      <div className="grid-4">
        <Stat label="Tax collected" value={formatMoney(summary.tax, currency, locale)} hint="On bills made" />
        <Stat label="Outstanding" value={formatMoney(summary.outstanding, currency, locale)} hint="Unpaid balance" />
        <Stat label="Staff commission" value={formatMoney(summary.commissions, currency, locale)} hint="Earned on services" />
        <Stat
          label="Retention"
          value={`${summary.retentionRate}%`}
          hint={`${summary.repeatCustomers} of ${summary.totalVisited} returning`}
        />
      </div>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>Daily movement</h2>
            <p>Sales, collections, and expenses per day.</p>
          </div>
        </div>
        <div className="card-body">
          {report.daily.length ? (
            <>
              <RevenueChart data={report.daily.map((day) => ({ day: day.date, value: day.collected }))} currency={currency} locale={locale} label="Collected in period" />
              <div className="table-wrap" style={{ marginTop: 18 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th className="num">Sales</th>
                      <th className="num">Collected</th>
                      <th className="num">Expenses</th>
                      <th className="num">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.daily.map((day) => (
                      <tr key={day.date}>
                        <td>{dayFormatter(day.date)}</td>
                        <td className="num">{formatMoney(day.sales, currency, locale)}</td>
                        <td className="num">{formatMoney(day.collected, currency, locale)}</td>
                        <td className="num">{formatMoney(day.expenses, currency, locale)}</td>
                        <td className="num">{formatMoney(day.sales - day.expenses, currency, locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <EmptyState icon="chart" title="No activity in this period" message="Bills, payments and expenses will show here once you add them." />
          )}
        </div>
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Top services</h2>
              <p>Based on money billed.</p>
            </div>
          </div>
          {report.topServices.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th className="num">Sold</th>
                    <th className="num">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {report.topServices.map((service) => (
                    <tr key={service.name}>
                      <td>{service.name}</td>
                      <td className="num">{service.count}</td>
                      <td className="num">{formatMoney(service.revenue, currency, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="card-body hint" style={{ margin: 0 }}>No service sales yet.</p>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2>Staff performance</h2>
              <p>Revenue, commission, and completed visits.</p>
            </div>
          </div>
          {report.staffPerformance.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Staff</th>
                    <th className="num">Completed</th>
                    <th className="num">Revenue</th>
                    <th className="num">Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {report.staffPerformance.map((member) => (
                    <tr key={member.id}>
                      <td>{member.name}</td>
                      <td className="num">{member.completed}</td>
                      <td className="num">{formatMoney(member.revenue, currency, locale)}</td>
                      <td className="num">{formatMoney(member.commission, currency, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="card-body hint" style={{ margin: 0 }}>No attributed sales yet.</p>
          )}
        </section>
      </div>

      <div className="grid-3">
        <section className="card">
          <div className="card-head">
            <h2>Appointments</h2>
          </div>
          <div className="card-body">
            {Object.keys(summary.appointments).length ? (
              <div className="chip-row">
                {Object.entries(summary.appointments).map(([status, count]) => (
                  <span key={status} className="chip">
                    {status.replaceAll("_", " ").toLowerCase()}
                    <span className="badge badge-plain">{count}</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="hint" style={{ margin: 0 }}>No appointments in the period.</p>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Payments</h2>
          </div>
          <div className="card-body">
            {report.paymentBreakdown.length ? (
              <ul className="simple-list">
                {report.paymentBreakdown.map((entry) => (
                  <li key={`${entry.kind}-${entry.method}`}>
                    <span>
                      {paymentMethodLabel(entry.method)} · {entry.kind === "REFUND" ? "money back" : "payment"}
                    </span>
                    <strong>{formatMoney(entry.amount, currency, locale)}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="hint" style={{ margin: 0 }}>No payments recorded.</p>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Expense categories</h2>
          </div>
          <div className="card-body">
            {report.expenseBreakdown.length ? (
              <ul className="simple-list">
                {report.expenseBreakdown.map((entry) => (
                  <li key={entry.category}>
                    <span>{entry.category}</span>
                    <strong>{formatMoney(entry.amount, currency, locale)}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="hint" style={{ margin: 0 }}>No expenses recorded.</p>
            )}
          </div>
        </section>
      </div>

      {report.hr ? (
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Staff &amp; salary</h2>
              <p>Attendance, salary, and leave in this period.</p>
            </div>
            <Link href="/staff?tab=attendance" className="btn btn-secondary btn-sm">Open staff records</Link>
          </div>
          <div className="card-body">
            <div className="grid-4">
              <div>
                <div className="field-label">Attendance</div>
                <div className="stat-value" style={{ fontSize: 22 }}>{report.hr.attendanceRate}%</div>
                <div className="hint">{report.hr.markedDays} days marked</div>
              </div>
              <div>
                <div className="field-label">Salary paid</div>
                <div className="stat-value" style={{ fontSize: 22 }}>{formatMoney(report.hr.salaryPaid, currency, locale)}</div>
                <div className="hint">{report.hr.salaryPayments} payment{report.hr.salaryPayments === 1 ? "" : "s"}</div>
              </div>
              <div>
                <div className="field-label">Advances paid</div>
                <div className="stat-value" style={{ fontSize: 22 }}>{formatMoney(report.hr.advancesPaid, currency, locale)}</div>
                <div className="hint">{report.hr.advancesCount} advance{report.hr.advancesCount === 1 ? "" : "s"}</div>
              </div>
              <div>
                <div className="field-label">Approved leave</div>
                <div className="stat-value" style={{ fontSize: 22 }}>{report.hr.approvedLeaves}</div>
                <div className="hint">Requests starting in period</div>
              </div>
            </div>
            {Object.keys(report.hr.attendance).length ? (
              <div className="chip-row" style={{ marginTop: 16 }}>
                {Object.entries(report.hr.attendance).map(([status, count]) => (
                  <span key={status} className="chip">
                    {status.replaceAll("_", " ").toLowerCase()}
                    <span className="badge badge-plain">{count}</span>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {report.lowStock.length ? (
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Low stock</h2>
              <p>Products that are running low.</p>
            </div>
            <Link href="/inventory?tab=products&lowStock=1" className="btn btn-secondary btn-sm">Open inventory</Link>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="num">Stock</th>
                  <th className="num">Alert at</th>
                </tr>
              </thead>
              <tbody>
                {report.lowStock.map((product) => (
                  <tr key={product.id}>
                    <td>{product.name}</td>
                    <td className="num text-danger">{product.stockQty} {product.unit}</td>
                    <td className="num">{product.reorderLevel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-foot">{hint}</div>
    </div>
  );
}
