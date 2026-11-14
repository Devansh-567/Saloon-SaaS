import type { Metadata } from "next";
import Link from "next/link";
import { requireTenantPage } from "@/lib/guards";
import { hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listExpenses } from "@/services/expenses";
import { zonedDateInput } from "@/lib/timezone";
import { asNumber, formatDay, formatMoney } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icons";
import { NewExpenseButton } from "@/components/expenses/expense-dialog";
import { ExpenseActions } from "@/components/expenses/expense-actions";

export const metadata: Metadata = { title: "Expenses" };
export const dynamic = "force-dynamic";

function parseDate(value: string | undefined, fallback: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; from?: string; to?: string; page?: string; new?: string }>;
}) {
  const context = await requireTenantPage("expenses.read");
  const params = await searchParams;
  const today = zonedDateInput(new Date(), context.salon.timezone);
  const monthStart = `${today.slice(0, 8)}01`;
  const fromDate = parseDate(params.from, monthStart);
  const toDate = parseDate(params.to, today);
  const page = Math.max(1, Number(params.page) || 1);
  const from = new Date(`${fromDate}T00:00:00.000Z`);
  const to = new Date(`${toDate}T23:59:59.999Z`);
  const canWrite = hasPermission(context, "expenses.write");

  const [data, rangeTotals, branches, categoryRows] = await Promise.all([
    listExpenses(context, { page, pageSize: 20, from, to, q: params.q }),
    prisma.expense.aggregate({
      where: { salonId: context.salon.id, status: "RECORDED", spentAt: { gte: from, lte: to } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.branch.findMany({ where: { salonId: context.salon.id }, orderBy: { createdAt: "asc" } }),
    prisma.expense.findMany({
      where: { salonId: context.salon.id, status: "RECORDED" },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    }),
  ]);

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Expenses</h1>
          <p className="page-subtitle">Overheads and vendor payments, feeding straight into profit reports.</p>
        </div>
        {canWrite ? (
          <div className="page-actions">
            <NewExpenseButton branches={branches.map((branch) => ({ id: branch.id, name: branch.name }))} defaultDate={today} autoOpen={params.new === "1"} />
          </div>
        ) : null}
      </div>

      <div className="grid-2">
        <div className="stat-card">
          <div className="stat-top">
            <span>Spend in range</span>
            <Icon name="receipt" />
          </div>
          <div className="stat-value">{formatMoney(asNumber(rangeTotals._sum.amount), context.salon.currency, context.salon.locale)}</div>
          <div className="stat-foot">
            {formatDay(from, context.salon.timezone, context.salon.locale)} – {formatDay(to, context.salon.timezone, context.salon.locale)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span>Recorded entries</span>
            <Icon name="file" />
          </div>
          <div className="stat-value">{rangeTotals._count}</div>
          <div className="stat-foot">{categoryRows.length} categories in use</div>
        </div>
      </div>

      <section className="card">
        <form className="toolbar" method="get">
          <div className="field grow" style={{ maxWidth: 260 }}>
            <label className="field-label" htmlFor="q">Search</label>
            <input id="q" name="q" className="input search" defaultValue={params.q || ""} placeholder="Vendor, category, notes" />
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
          <Link href="/expenses" className="btn btn-ghost">This month</Link>
        </form>

        {data.items.length ? (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th className="hide-mobile">Vendor</th>
                    <th className="hide-mobile">Branch</th>
                    <th className="hide-mobile">Receipt</th>
                    <th className="num">Amount</th>
                    {canWrite ? <th /> : null}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((expense) => (
                    <tr key={expense.id}>
                      <td>{formatDay(expense.spentAt, context.salon.timezone, context.salon.locale)}</td>
                      <td>
                        <div className="cell-title">{expense.category}</div>
                        {expense.notes ? <div className="cell-sub">{expense.notes}</div> : null}
                      </td>
                      <td className="hide-mobile">{expense.vendor || "—"}</td>
                      <td className="hide-mobile">{expense.branch || "All"}</td>
                      <td className="hide-mobile">
                        {expense.receipt ? (
                          <a className="link" href={`/api/files/${expense.receipt.id}`} target="_blank" rel="noreferrer">
                            {expense.receipt.originalName.length > 22 ? `${expense.receipt.originalName.slice(0, 22)}…` : expense.receipt.originalName}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="num">{formatMoney(expense.amount, context.salon.currency, context.salon.locale)}</td>
                      {canWrite ? (
                        <td>
                          <ExpenseActions expenseId={expense.id} label={`${expense.category} · ${formatMoney(expense.amount, context.salon.currency, context.salon.locale)}`} />
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              pages={data.pages}
              total={data.total}
              basePath="/expenses"
              params={{ q: params.q, from: fromDate, to: toDate }}
            />
          </>
        ) : (
          <EmptyState
            icon="receipt"
            title="No expenses in this range"
            message="Adjust the dates or record an expense to start tracking overheads."
          />
        )}
      </section>
    </div>
  );
}
