"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, errorMessage } from "@/lib/client";
import { calculateInvoice } from "@/lib/invoice-calc";
import { formatMoney, paymentMethodLabel, roundMoney } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { CustomerPicker } from "@/components/forms/customer-picker";
import { Icon } from "@/components/ui/icons";

type Service = { id: string; name: string; price: number; active: boolean; taxRate: { rate: number } | null };
type Product = { id: string; name: string; price: number; stockQty: number; unit: string; active: boolean; taxRate: { rate: number } | null };
type Staff = { id: string; name: string };
type Branch = { id: string; name: string; active: boolean };
type Customer = { id: string; name: string; phone: string; email: string | null };

type Line = {
  key: number;
  kind: "SERVICE" | "PRODUCT";
  serviceId: string;
  productId: string;
  staffMembershipId: string;
  quantity: number;
};

type PaymentRow = { key: number; method: "CASH" | "CARD" | "UPI" | "BANK" | "OTHER"; amount: string };

let lineKey = 1;
let paymentKey = 1;

export function InvoiceBuilder({
  services,
  products,
  staff,
  branches,
  initialCustomer,
  currency,
  locale,
}: {
  services: Service[];
  products: Product[];
  staff: Staff[];
  branches: Branch[];
  initialCustomer?: Customer | null;
  currency: string;
  locale: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [lines, setLines] = useState<Line[]>([{ key: lineKey++, kind: "SERVICE", serviceId: "", productId: "", staffMembershipId: "", quantity: 1 }]);
  const [discount, setDiscount] = useState(0);
  const [branchId, setBranchId] = useState(branches.find((branch) => branch.active)?.id || "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  // One key per bill screen: a double tap or network retry can never create two bills.
  const idempotencyKey = useRef(
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `bill-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  const serviceMap = useMemo(() => new Map(services.map((service) => [service.id, service])), [services]);
  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  const calculated = useMemo(() => {
    const input = lines
      .map((line) => {
        if (line.kind === "SERVICE") {
          const service = serviceMap.get(line.serviceId);
          if (!service) return null;
          return { quantity: line.quantity, unitPrice: service.price, taxRate: service.taxRate?.rate || 0, commissionRate: 0 };
        }
        const product = productMap.get(line.productId);
        if (!product) return null;
        return { quantity: line.quantity, unitPrice: product.price, taxRate: product.taxRate?.rate || 0, commissionRate: 0 };
      })
      .filter((line): line is { quantity: number; unitPrice: number; taxRate: number; commissionRate: number } => Boolean(line));
    if (!input.length) return null;
    try {
      return calculateInvoice(input, discount);
    } catch {
      return null;
    }
  }, [lines, discount, serviceMap, productMap]);

  function updateLine(key: number, patch: Partial<Line>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function addLine(kind: "SERVICE" | "PRODUCT") {
    setLines((current) => [...current, { key: lineKey++, kind, serviceId: "", productId: "", staffMembershipId: "", quantity: 1 }]);
  }

  function removeLine(key: number) {
    setLines((current) => (current.length > 1 ? current.filter((line) => line.key !== key) : current));
  }

  const billTotal = calculated?.total || 0;
  const paidNow = roundMoney(payments.reduce((sum, row) => sum + (Number(row.amount) || 0), 0));
  const balanceDue = roundMoney(billTotal - paidNow);

  function payInFull(method: PaymentRow["method"]) {
    setPayments([{ key: paymentKey++, method, amount: billTotal.toFixed(2) }]);
  }

  function addPaymentRow() {
    setPayments((current) =>
      current.length >= 5
        ? current
        : [...current, { key: paymentKey++, method: "CASH", amount: Math.max(0, balanceDue).toFixed(2) }],
    );
  }

  function updatePayment(key: number, patch: Partial<PaymentRow>) {
    setPayments((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function removePayment(key: number) {
    setPayments((current) => current.filter((row) => row.key !== key));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError("");
    const form = new FormData(event.currentTarget);
    const payloadLines = lines
      .map((line) => ({
        kind: line.kind,
        serviceId: line.kind === "SERVICE" ? line.serviceId : null,
        productId: line.kind === "PRODUCT" ? line.productId : null,
        staffMembershipId: line.staffMembershipId || null,
        quantity: line.quantity,
      }))
      .filter((line) => (line.kind === "SERVICE" ? line.serviceId : line.productId));
    if (!payloadLines.length) {
      setError("Add at least one service or product line with a selection.");
      return;
    }
    if (paidNow > billTotal + 0.001) {
      setError("The payments add up to more than the bill total. Please correct the amounts.");
      return;
    }
    setPending(true);
    try {
      const invoice = await apiRequest<{ id: string }>("/api/invoices", {
        method: "POST",
        body: JSON.stringify({
          customerId: form.get("customerId") || null,
          idempotencyKey: idempotencyKey.current,
          payments: payments
            .filter((row) => Number(row.amount) > 0)
            .map((row) => ({ method: row.method, amount: Number(row.amount) })),
          branchId,
          discount: Number(discount) || 0,
          notes: form.get("notes") || undefined,
          items: payloadLines,
        }),
      });
      toast.success(paidNow > 0 ? "Bill saved and payment recorded." : "Bill saved. Payment is still due.");
      router.push(`/billing/${invoice.id}`);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="rich-grid">
      <div className="stack">
        <section className="card">
          <div className="card-head">
            <h2>Bill details</h2>
          </div>
          <div className="card-body">
            {error ? <div className="alert alert-error">{error}</div> : null}
            <div className="form-grid">
              <div>
                <CustomerPicker initial={initialCustomer} required={false} />
                <small>No saved profile? Leave this empty.</small>
              </div>
              <div className="field">
                <label htmlFor="branchId">Branch</label>
                <select id="branchId" className="select" value={branchId} onChange={(event) => setBranchId(event.target.value)} required>
                  {branches.filter((branch) => branch.active).map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2>Items on this bill</h2>
              <p>Prices come from your price list. Stock goes down automatically when the bill is saved.</p>
            </div>
          </div>
          <div className="card-body">
            <div className="line-items">
              {lines.map((line) => {
                const service = serviceMap.get(line.serviceId);
                const product = productMap.get(line.productId);
                const unitPrice = service?.price ?? product?.price ?? 0;
                const taxRate = service?.taxRate?.rate ?? product?.taxRate?.rate ?? 0;
                return (
                  <div className="line-item" key={line.key}>
                    <div className="field">
                      <label className="field-label">{line.kind === "SERVICE" ? "Service" : "Product"}</label>
                      {line.kind === "SERVICE" ? (
                        <select
                          className="select"
                          value={line.serviceId}
                          onChange={(event) => updateLine(line.key, { serviceId: event.target.value })}
                          required
                        >
                          <option value="">Choose service</option>
                          {services.filter((item) => item.active).map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name} · {formatMoney(item.price, currency, locale)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <select
                          className="select"
                          value={line.productId}
                          onChange={(event) => updateLine(line.key, { productId: event.target.value })}
                          required
                        >
                          <option value="">Choose product</option>
                          {products.filter((item) => item.active).map((item) => (
                            <option key={item.id} value={item.id} disabled={item.stockQty <= 0}>
                              {item.name} · {formatMoney(item.price, currency, locale)} · {item.stockQty} {item.unit}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div className="field">
                      <label className="field-label">Quantity</label>
                      <input
                        type="number"
                        className="input"
                        min={1}
                        max={line.kind === "PRODUCT" ? Math.max(1, product?.stockQty || 1) : 999}
                        value={line.quantity}
                        onChange={(event) => updateLine(line.key, { quantity: Math.max(1, Number(event.target.value) || 1) })}
                      />
                    </div>
                    <div className="field">
                      <label className="field-label">Done by</label>
                      <select
                        className="select"
                        value={line.staffMembershipId}
                        onChange={(event) => updateLine(line.key, { staffMembershipId: event.target.value })}
                      >
                        <option value="">Unassigned</option>
                        {staff.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end" }}>
                      <div className="line-item-total">
                        {formatMoney(roundMoney(unitPrice * line.quantity * (1 + taxRate / 100)), currency, locale)}
                        <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 400 }}>
                          {taxRate ? `${taxRate}% tax` : "no tax"}
                        </div>
                      </div>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeLine(line.key)} disabled={lines.length === 1}>
                        <Icon name="trash" /> Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="form-actions" style={{ justifyContent: "flex-start" }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => addLine("SERVICE")}>
                <Icon name="plus" /> Add service
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => addLine("PRODUCT")}>
                <Icon name="plus" /> Add product
              </button>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-body">
            <div className="field">
              <label htmlFor="notes">Note on bill</label>
              <textarea id="notes" name="notes" className="textarea" placeholder="The customer will see this on the bill" />
            </div>
          </div>
        </section>
      </div>

      <div className="stack">
        <section className="card">
          <div className="card-head">
            <h2>Summary</h2>
          </div>
          <div className="card-body">
            <div className="field" style={{ marginBottom: 14 }}>
              <label htmlFor="discount">Discount (amount)</label>
              <input
                id="discount"
                type="number"
                className="input"
                min={0}
                step="0.01"
                value={discount || ""}
                onChange={(event) => setDiscount(Number(event.target.value) || 0)}
                placeholder="0.00"
              />
              <small>Shared across all items.</small>
            </div>
            <div className="totals-box" style={{ width: "100%" }}>
              <div>
                <span>Subtotal</span>
                <span>{formatMoney(calculated?.subtotal || 0, currency, locale)}</span>
              </div>
              <div>
                <span>Discount</span>
                <span>−{formatMoney(calculated?.discount || 0, currency, locale)}</span>
              </div>
              <div>
                <span>Tax</span>
                <span>{formatMoney(calculated?.taxTotal || 0, currency, locale)}</span>
              </div>
              <div className="grand">
                <span>Total</span>
                <span>{formatMoney(calculated?.total || 0, currency, locale)}</span>
              </div>
            </div>
            <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
              <strong>Money received now</strong>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(["CASH", "UPI", "CARD"] as const).map((method) => (
                  <button key={method} type="button" className="btn btn-secondary btn-sm" onClick={() => payInFull(method)} disabled={!billTotal}>
                    Paid in full · {paymentMethodLabel(method)}
                  </button>
                ))}
              </div>
              {payments.map((row) => (
                <div key={row.key} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <select className="select" aria-label="Payment method" value={row.method} onChange={(event) => updatePayment(row.key, { method: event.target.value as PaymentRow["method"] })}>
                    {["CASH", "UPI", "CARD", "BANK", "OTHER"].map((method) => (
                      <option key={method} value={method}>{paymentMethodLabel(method)}</option>
                    ))}
                  </select>
                  <input className="input" type="number" min={0} step="0.01" inputMode="decimal" aria-label="Payment amount" value={row.amount} onChange={(event) => updatePayment(row.key, { amount: event.target.value })} />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => removePayment(row.key)} aria-label="Remove payment">
                    <Icon name="trash" />
                  </button>
                </div>
              ))}
              <button type="button" className="btn btn-ghost btn-sm" onClick={addPaymentRow} disabled={!billTotal || payments.length >= 5}>
                <Icon name="plus" /> {payments.length ? "Pay part with another method" : "Add payment"}
              </button>
              <div className="totals-box" style={{ width: "100%" }}>
                <div>
                  <span>Received now</span>
                  <span>{formatMoney(paidNow, currency, locale)}</span>
                </div>
                <div className="grand">
                  <span>{balanceDue < 0 ? "Too much by" : "Still to pay"}</span>
                  <span>{formatMoney(Math.abs(balanceDue), currency, locale)}</span>
                </div>
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-block btn-lg" style={{ marginTop: 16 }} disabled={pending}>
              <Icon name="check" />
              {pending ? "Saving bill…" : paidNow > 0 && balanceDue <= 0 ? "Complete bill" : "Save bill"}
            </button>
            <p className="hint" style={{ marginTop: 10, textAlign: "center" }}>
              Bill numbers are given automatically.
            </p>
          </div>
        </section>
      </div>
    </form>
  );
}
