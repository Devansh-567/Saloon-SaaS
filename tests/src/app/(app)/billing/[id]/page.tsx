import { BRAND } from "@/lib/brand";
import { PoweredBy } from "@/components/brand/company-logo";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenantPage } from "@/lib/guards";
import { hasPermission } from "@/lib/auth";
import { getInvoice } from "@/services/billing";
import { formatDate, formatMoney, paymentMethodLabel } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/badge";
import { InvoiceActions } from "@/components/billing/invoice-actions";
import { Icon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Bill" };
export const dynamic = "force-dynamic";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const context = await requireTenantPage("billing.read");
  const { id } = await params;
  const invoice = await getInvoice(context, id);
  if (!invoice) notFound();
  const logo = context.salon.logoFileId ? `/api/files/${context.salon.logoFileId}` : null;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head no-print">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link href="/billing" className="icon-btn" aria-label="Back to billing">
            <Icon name="arrow" style={{ transform: "rotate(180deg)" }} />
          </Link>
          <div>
            <h1 style={{ marginBottom: 2 }}>{invoice.number}</h1>
            <p className="page-subtitle">
              Issued {invoice.issuedAt ? formatDate(invoice.issuedAt, context.salon.timezone, context.salon.locale) : "—"}
              {invoice.dueAt ? ` · pay by ${formatDate(invoice.dueAt, context.salon.timezone, context.salon.locale)}` : ""}
            </p>
          </div>
          <StatusBadge status={invoice.status} />
        </div>
        <InvoiceActions
          salonName={context.salon.name}
          invoice={{
            id: invoice.id,
            number: invoice.number,
            status: invoice.status,
            total: invoice.total,
            netPaid: invoice.netPaid,
            balance: invoice.balance,
            hasContact: Boolean(invoice.customer?.email || invoice.customer?.phone),
            contactHint: invoice.customer?.email || invoice.customer?.phone || "",
          }}
          canWrite={hasPermission(context, "billing.write")}
          canRefund={hasPermission(context, "billing.refund")}
          canSend={hasPermission(context, "notifications.send")}
          currency={context.salon.currency}
          locale={context.salon.locale}
        />
      </div>

      <div className="invoice-sheet">
        <div className="invoice-top">
          <div className="invoice-brand">
            <span className="brand-mark">{logo ? <img src={logo} alt="" /> : context.salon.name.slice(0, 1).toUpperCase()}</span>
            <div>
              <h2>{context.salon.name}</h2>
              <div style={{ color: "var(--muted)", fontSize: 12 }}>
                {context.salon.address ? `${context.salon.address} · ` : ""}
                {context.salon.phone}
              </div>
              {context.salon.email ? <div style={{ color: "var(--muted)", fontSize: 12 }}>{context.salon.email}</div> : null}
            </div>
          </div>
          <div className="invoice-meta">
            <strong>{invoice.number}</strong>
            <div>Status: {invoice.status.replaceAll("_", " ").toLowerCase()}</div>
            <div>Issued: {invoice.issuedAt ? formatDate(invoice.issuedAt, context.salon.timezone, context.salon.locale) : "—"}</div>
            {invoice.dueAt ? <div>Due: {formatDate(invoice.dueAt, context.salon.timezone, context.salon.locale)}</div> : null}
          </div>
        </div>

        <div className="invoice-parties">
          <div>
            <div className="label">Billed to</div>
            {invoice.customer ? (
              <>
                <strong>{invoice.customer.name}</strong>
                <span>{invoice.customer.phone}</span>
                {invoice.customer.email ? <span>{invoice.customer.email}</span> : null}
              </>
            ) : (
              <strong>Customer</strong>
            )}
          </div>
          <div>
            <div className="label">Branch</div>
            <strong>{invoice.branch.name}</strong>
            <span>{context.salon.currency} · {context.salon.timezone.replaceAll("_", " ")}</span>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Description</th>
                <th className="hide-mobile">Staff</th>
                <th className="num">Qty</th>
                <th className="num">Unit</th>
                <th className="num hide-mobile">Tax</th>
                <th className="num hide-mobile">Discount</th>
                <th className="num">Line total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="cell-title">{item.description}</div>
                    <div className="cell-sub">{item.kind.toLowerCase()}</div>
                  </td>
                  <td className="hide-mobile">{item.staff?.name || "—"}</td>
                  <td className="num">{item.quantity}</td>
                  <td className="num">{formatMoney(item.unitPrice, context.salon.currency, context.salon.locale)}</td>
                  <td className="num hide-mobile">{formatMoney(item.taxAmount, context.salon.currency, context.salon.locale)}</td>
                  <td className="num hide-mobile">{formatMoney(item.discountAmount, context.salon.currency, context.salon.locale)}</td>
                  <td className="num">{formatMoney(item.lineTotal, context.salon.currency, context.salon.locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="invoice-totals">
          <div className="totals-box">
            <div>
              <span>Subtotal</span>
              <span>{formatMoney(invoice.subtotal, context.salon.currency, context.salon.locale)}</span>
            </div>
            <div>
              <span>Discount</span>
              <span>−{formatMoney(invoice.discount, context.salon.currency, context.salon.locale)}</span>
            </div>
            <div>
              <span>Tax</span>
              <span>{formatMoney(invoice.taxTotal, context.salon.currency, context.salon.locale)}</span>
            </div>
            <div className="grand">
              <span>Total</span>
              <span>{formatMoney(invoice.total, context.salon.currency, context.salon.locale)}</span>
            </div>
            <div>
              <span>Paid</span>
              <span>{formatMoney(invoice.amountPaid, context.salon.currency, context.salon.locale)}</span>
            </div>
            {invoice.amountRefunded > 0 ? (
              <div>
                <span>Money given back</span>
                <span>−{formatMoney(invoice.amountRefunded, context.salon.currency, context.salon.locale)}</span>
              </div>
            ) : null}
            <div className="grand">
              <span>Balance</span>
              <span>{formatMoney(invoice.balance, context.salon.currency, context.salon.locale)}</span>
            </div>
          </div>
        </div>

        {invoice.notes ? (
          <div className="callout" style={{ marginTop: 22 }}>
            <div className="field-label">Notes</div>
            <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{invoice.notes}</p>
          </div>
        ) : null}
        <div style={{ marginTop: 22, textAlign: "center", color: "var(--muted)", fontSize: 11 }}>
          Thank you for choosing {context.salon.name}.
        </div>
        {BRAND.showOnBills ? <PoweredBy /> : null}
      </div>

      <section className="card no-print">
        <div className="card-head">
          <div>
            <h2>Payment history</h2>
            <p>Every payment received and money given back for this bill.</p>
          </div>
          <span className="badge badge-plain">{invoice.payments.length} entries</span>
        </div>
        {invoice.payments.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Method</th>
                  <th className="hide-mobile">Reference / notes</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatDate(payment.createdAt, context.salon.timezone, context.salon.locale)}</td>
                    <td>
                      <span className={`badge ${payment.kind === "REFUND" ? "badge-danger" : "badge-success"}`}>
                        {payment.kind === "REFUND" ? "Money back" : "Payment"}
                      </span>
                    </td>
                    <td>{paymentMethodLabel(payment.method)}</td>
                    <td className="hide-mobile">{payment.reference || payment.notes || "—"}</td>
                    <td className="num">{formatMoney(payment.amount, context.salon.currency, context.salon.locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card-body" style={{ color: "var(--muted)", fontSize: 12.5 }}>
            No payments recorded yet. Record a payment from the actions above.
          </div>
        )}
      </section>
    </div>
  );
}
