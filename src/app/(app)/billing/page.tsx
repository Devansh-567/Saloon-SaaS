import type { Metadata } from "next";
import Link from "next/link";
import { InvoiceStatus } from "@prisma/client";
import { requireTenantPage } from "@/lib/guards";
import { hasPermission } from "@/lib/auth";
import { listInvoices } from "@/services/billing";
import { prisma } from "@/lib/prisma";
import { asNumber, formatDay, formatMoney, roundMoney } from "@/lib/utils";
import { StatusBadge, statusLabel } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Billing" };
export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const context = await requireTenantPage("billing.read");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const status = Object.values(InvoiceStatus).includes(params.status as InvoiceStatus)
    ? (params.status as InvoiceStatus)
    : undefined;
  const [data, totals] = await Promise.all([
    listInvoices(context, { q: params.q, status, page, pageSize: 20 }),
    prisma.invoice.aggregate({
      where: { salonId: context.salon.id, status: { notIn: ["VOID", "DRAFT"] } },
      _sum: { total: true, amountPaid: true, amountRefunded: true },
      _count: true,
    }),
  ]);
  const invoiced = asNumber(totals._sum.total);
  const collected = roundMoney(asNumber(totals._sum.amountPaid) - asNumber(totals._sum.amountRefunded));
  const outstanding = roundMoney(invoiced - collected);
  const canWrite = hasPermission(context, "billing.write");

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Billing</h1>
          <p className="page-subtitle">All your bills, payments received and money given back.</p>
        </div>
        <div className="page-actions">
          {canWrite ? (
            <Link href="/billing/new" className="btn btn-primary">
              <Icon name="plus" /> New invoice
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid-3">
        <div className="stat-card">
          <div className="stat-top">
            <span>Billed</span>
            <Icon name="receipt" />
          </div>
          <div className="stat-value">{formatMoney(invoiced, context.salon.currency, context.salon.locale)}</div>
          <div className="stat-foot">{totals._count} bills made</div>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span>Money received</span>
            <Icon name="money" />
          </div>
          <div className="stat-value">{formatMoney(collected, context.salon.currency, context.salon.locale)}</div>
          <div className="stat-foot">After money given back</div>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span>Still to receive</span>
            <Icon name="clock" />
          </div>
          <div className="stat-value">{formatMoney(outstanding, context.salon.currency, context.salon.locale)}</div>
          <div className="stat-foot">Customers who still owe</div>
        </div>
      </div>

      <section className="card">
        <form className="toolbar" method="get">
          <div className="field grow" style={{ maxWidth: 380 }}>
            <label htmlFor="q" className="field-label">Search</label>
            <input id="q" name="q" className="input search" defaultValue={params.q || ""} placeholder="Bill number, customer name or phone" />
          </div>
          <div className="field">
            <label htmlFor="status" className="field-label">Status</label>
            <select id="status" name="status" className="select" defaultValue={params.status || ""}>
              <option value="">All statuses</option>
              {Object.values(InvoiceStatus).map((value) => (
                <option key={value} value={value}>
                  {statusLabel(value)}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-secondary">
            <Icon name="filter" /> Apply
          </button>
          {params.q || params.status ? (
            <Link href="/billing" className="btn btn-ghost">
              Clear
            </Link>
          ) : null}
        </form>

        {data.items.length ? (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Bill</th>
                    <th>Customer</th>
                    <th className="hide-mobile">Branch</th>
                    <th className="num hide-mobile">Paid</th>
                    <th className="num">Total</th>
                    <th>Status</th>
                    <th className="hide-mobile">Issued</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((invoice) => (
                    <tr key={invoice.id}>
                      <td>
                        <Link href={`/billing/${invoice.id}`} className="link">
                          {invoice.number}
                        </Link>
                        <div className="cell-sub">{invoice.itemCount} item{invoice.itemCount === 1 ? "" : "s"}</div>
                      </td>
                      <td>
                        {invoice.customerName}
                        {invoice.customerPhone ? <div className="cell-sub">{invoice.customerPhone}</div> : null}
                      </td>
                      <td className="hide-mobile">{invoice.branch}</td>
                      <td className="num hide-mobile">{formatMoney(roundMoney(invoice.amountPaid - invoice.amountRefunded), context.salon.currency, context.salon.locale)}</td>
                      <td className="num">{formatMoney(invoice.total, context.salon.currency, context.salon.locale)}</td>
                      <td><StatusBadge status={invoice.status} /></td>
                      <td className="hide-mobile">{formatDay(invoice.createdAt, context.salon.timezone, context.salon.locale)}</td>
                      <td>
                        <div className="actions">
                          <Link href={`/billing/${invoice.id}`} className="btn btn-ghost btn-sm">Open</Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pages={data.pages} total={data.total} basePath="/billing" params={{ q: params.q, status: params.status }} />
          </>
        ) : (
          <EmptyState
            icon="receipt"
            title={params.q || params.status ? "No bills found" : "No bills yet"}
            message={params.q || params.status ? "Try a different search or clear the status filter." : "Make your first bill when a customer is ready to pay."}
            action={canWrite ? <Link href="/billing/new" className="btn btn-primary">Create invoice</Link> : null}
          />
        )}
      </section>
    </div>
  );
}
