"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, errorMessage } from "@/lib/client";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { Icon } from "@/components/ui/icons";
import { formatMoney, paymentMethodLabel } from "@/lib/utils";

type Invoice = {
  id: string;
  number: string;
  status: string;
  total: number;
  netPaid: number;
  balance: number;
  hasContact: boolean;
  contactHint: string;
};

export function InvoiceActions({
  invoice,
  canWrite,
  canRefund,
  canSend,
  currency,
  locale,
}: {
  invoice: Invoice;
  canWrite: boolean;
  canRefund: boolean;
  canSend: boolean;
  currency: string;
  locale: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const closed = invoice.status === "VOID";

  async function recordPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      await apiRequest(`/api/invoices/${invoice.id}/payments`, {
        method: "POST",
        body: JSON.stringify({
          amount: Number(form.get("amount")),
          method: form.get("method"),
          reference: form.get("reference") || null,
          notes: form.get("notes") || null,
        }),
      });
      toast.success("Payment recorded.");
      setPaymentOpen(false);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function recordRefund(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      await apiRequest(`/api/invoices/${invoice.id}/refunds`, {
        method: "POST",
        body: JSON.stringify({
          amount: Number(form.get("amount")),
          method: form.get("method"),
          reason: form.get("reason"),
          restockProducts: form.get("restockProducts") === "on",
        }),
      });
      toast.success("Money given back.");
      setRefundOpen(false);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function voidInvoice() {
    setPending(true);
    try {
      await apiRequest(`/api/invoices/${invoice.id}/void`, { method: "POST" });
      toast.success("Bill cancelled and stock added back.");
      setVoidOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  async function send(channel: "EMAIL" | "SMS" | "WHATSAPP") {
    setPending(true);
    try {
      const log = await apiRequest<{ status: string; error?: string | null }>(`/api/invoices/${invoice.id}/send`, {
        method: "POST",
        body: JSON.stringify({ channel }),
      });
      if (log.status === "ACCEPTED") {
        toast.success("Bill sent.");
      } else if (log.status === "SKIPPED") {
        toast.error(log.error || "Provider is not configured. Nothing was sent.");
      } else {
        toast.error(log.error || "The provider rejected the message.");
      }
      setSendOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="page-actions no-print">
        <a className="btn btn-secondary" href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer">
          <Icon name="download" /> PDF
        </a>
        {canSend ? (
          <button type="button" className="btn btn-secondary" onClick={() => setSendOpen(true)} disabled={closed}>
            <Icon name="send" /> Send
          </button>
        ) : null}
        {canWrite && !closed ? (
          invoice.balance > 0 ? (
            <button type="button" className="btn btn-primary" onClick={() => setPaymentOpen(true)}>
              <Icon name="money" /> Record payment
            </button>
          ) : null
        ) : null}
        {canRefund && !closed && invoice.netPaid > 0 ? (
          <button type="button" className="btn btn-secondary" onClick={() => setRefundOpen(true)}>
            <Icon name="refresh" /> Refund
          </button>
        ) : null}
        {canWrite && !closed && invoice.netPaid <= 0 ? (
          <button type="button" className="btn btn-soft-danger" onClick={() => setVoidOpen(true)}>
            <Icon name="ban" /> Void
          </button>
        ) : null}
      </div>

      <Modal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        title="Record payment"
        description={`Outstanding balance: ${formatMoney(invoice.balance, currency, locale)}`}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setPaymentOpen(false)} disabled={pending}>
              Cancel
            </button>
            <button type="submit" form="payment-form" className="btn btn-primary" disabled={pending}>
              {pending ? "Recording…" : "Record payment"}
            </button>
          </>
        }
      >
        {error ? <div className="alert alert-error">{error}</div> : null}
        <form id="payment-form" onSubmit={recordPayment}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="amount">Amount</label>
              <input id="amount" name="amount" type="number" min={0.01} step="0.01" className="input" defaultValue={invoice.balance.toFixed(2)} required autoFocus />
            </div>
            <div className="field">
              <label htmlFor="method">Method</label>
              <select id="method" name="method" className="select" defaultValue="CASH">
                {["CASH", "CARD", "UPI", "BANK", "OTHER"].map((method) => (
                  <option key={method} value={method}>{paymentMethodLabel(method)}</option>
                ))}
              </select>
            </div>
            <div className="field span-2">
              <label htmlFor="reference">Reference</label>
              <input id="reference" name="reference" className="input" placeholder="Optional transaction reference" />
            </div>
            <div className="field span-2">
              <label htmlFor="payment-notes">Notes</label>
              <textarea id="payment-notes" name="notes" className="textarea" />
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={refundOpen}
        onClose={() => setRefundOpen(false)}
        title="Give money back"
        description={`Most you can give back: ${formatMoney(invoice.netPaid, currency, locale)}`}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setRefundOpen(false)} disabled={pending}>
              Cancel
            </button>
            <button type="submit" form="refund-form" className="btn btn-danger" disabled={pending}>
              {pending ? "Saving…" : "Give money back"}
            </button>
          </>
        }
      >
        {error ? <div className="alert alert-error">{error}</div> : null}
        <form id="refund-form" onSubmit={recordRefund}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="refund-amount">Amount</label>
              <input id="refund-amount" name="amount" type="number" min={0.01} max={invoice.netPaid} step="0.01" className="input" defaultValue={invoice.netPaid.toFixed(2)} required />
            </div>
            <div className="field">
              <label htmlFor="refund-method">Method</label>
              <select id="refund-method" name="method" className="select" defaultValue="CASH">
                {["CASH", "CARD", "UPI", "BANK", "OTHER"].map((method) => (
                  <option key={method} value={method}>{paymentMethodLabel(method)}</option>
                ))}
              </select>
            </div>
            <div className="field span-2">
              <label htmlFor="reason">Reason</label>
              <textarea id="reason" name="reason" className="textarea" required minLength={2} />
            </div>
            <label className="span-2" style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" name="restockProducts" />
              <span>Put the products back in stock (only if the whole bill is returned)</span>
            </label>
          </div>
        </form>
      </Modal>

      <Modal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        title="Send bill"
        description={invoice.hasContact ? invoice.contactHint : "This customer has no email or phone on file."}
        footer={
          <button type="button" className="btn btn-secondary" onClick={() => setSendOpen(false)}>
            Close
          </button>
        }
      >
        <div style={{ display: "grid", gap: 8 }}>
          {(["EMAIL", "SMS", "WHATSAPP"] as const).map((channel) => (
            <button key={channel} type="button" className="btn btn-secondary" style={{ justifyContent: "space-between" }} onClick={() => send(channel)} disabled={pending}>
              <span>{channel === "EMAIL" ? "Email the bill" : channel === "SMS" ? "Send a text message" : "Send on WhatsApp"}</span>
              <Icon name={channel === "EMAIL" ? "mail" : "send"} />
            </button>
          ))}
          <p className="hint" style={{ margin: "6px 0 0" }}>
            Delivery depends on the provider configured by the platform. Accepted means the provider took the message, not that
            the customer has read it.
          </p>
        </div>
      </Modal>

      <ConfirmDialog
        open={voidOpen}
        onClose={() => setVoidOpen(false)}
        onConfirm={voidInvoice}
        title="Cancel this bill?"
        message="Cancelling removes this bill for good and puts any products back in stock. A bill that already has a payment cannot be cancelled; give the money back instead."
        confirmLabel="Cancel bill"
        danger
        pending={pending}
      />
    </>
  );
}
