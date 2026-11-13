# Copyright (c) 2026 Devansh Singh
# All Rights Reserved.
#
# This software and its source code are proprietary
# and confidential property of Guru AI Technologies.
#
# Unauthorized copying, modification, distribution,
# or use of this software, in whole or in part,
# is strictly prohibited without prior written
# permission from Guru AI Technologies.
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
  salonName,
  onlinePayments,
}: {
  salonName: string;
  onlinePayments: boolean;
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
  const [sharing, setSharing] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [payLink, setPayLink] = useState<{ url: string; amount: number } | null>(null);

  async function createPayLink() {
    setLinkBusy(true);
    try {
      setPayLink(await apiRequest<{ url: string; amount: number }>(`/api/invoices/${invoice.id}/payment-link`, { method: "POST" }));
    } catch (linkError) {
      toast.error(errorMessage(linkError));
    } finally {
      setLinkBusy(false);
    }
  }

  async function copyPayLink() {
    if (!payLink) return;
    try {
      await navigator.clipboard.writeText(payLink.url);
      toast.success("Link copied.");
    } catch {
      toast.error("Could not copy. Please select the link and copy it.");
    }
  }

  function sharePayLinkOnWhatsApp() {
    if (!payLink) return;
    const text = `Bill ${invoice.number} from ${salonName}\nAmount to pay: ${formatMoney(payLink.amount, currency, locale)}\nPay online (UPI, card or net banking): ${payLink.url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }
  const closed = invoice.status === "VOID";

  async function shareOnWhatsApp() {
    setSharing(true);
    const lines = [
      `Bill ${invoice.number} from ${salonName}`,
      `Total: ${formatMoney(invoice.total, currency, locale)}`,
      `Paid: ${formatMoney(invoice.netPaid, currency, locale)}`,
      invoice.balance > 0 ? `Balance to pay: ${formatMoney(invoice.balance, currency, locale)}` : "Fully paid. Thank you!",
    ];
    const text = lines.join("\n");
    let blob: Blob | null = null;
    try {
      const response = await fetch(`/api/invoices/${invoice.id}/pdf`, { credentials: "same-origin" });
      if (response.ok) blob = await response.blob();
      if (blob) {
        const file = new File([blob], `bill-${invoice.number}.pdf`, { type: "application/pdf" });
        if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], text, title: `Bill ${invoice.number}` });
          setSharing(false);
          return;
        }
      }
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") {
        setSharing(false);
        return;
      }
    }
    if (blob) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `bill-${invoice.number}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast.success("Bill PDF saved. Attach it in WhatsApp if you want to send the file.");
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
    setSharing(false);
  }

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
          <Icon name="download" /> Download Bill
        </a>
        {onlinePayments && !closed && invoice.balance > 0 ? (
          <button type="button" className="btn btn-primary" onClick={createPayLink} disabled={linkBusy}>
            <Icon name="card" /> {linkBusy ? "Please waitâ€¦" : "Get Payment Link"}
          </button>
        ) : null}
        <button type="button" className="btn btn-secondary" onClick={shareOnWhatsApp} disabled={closed || sharing}>
          <Icon name="send" /> {sharing ? "Openingâ€¦" : "Share on WhatsApp"}
        </button>
        {canSend ? (
          <button type="button" className="btn btn-secondary" onClick={() => setSendOpen(true)} disabled={closed}>
            <Icon name="mail" /> Email / Text
          </button>
        ) : null}
        {canWrite && !closed ? (
          invoice.balance > 0 ? (
            <button type="button" className="btn btn-primary" onClick={() => setPaymentOpen(true)}>
              <Icon name="money" /> Add Payment
            </button>
          ) : null
        ) : null}
        {canRefund && !closed && invoice.netPaid > 0 ? (
          <button type="button" className="btn btn-secondary" onClick={() => setRefundOpen(true)}>
            <Icon name="refresh" /> Give Money Back
          </button>
        ) : null}
        {canWrite && !closed && invoice.netPaid <= 0 ? (
          <button type="button" className="btn btn-soft-danger" onClick={() => setVoidOpen(true)}>
            <Icon name="ban" /> Cancel Bill
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
              {pending ? "Recordingâ€¦" : "Record payment"}
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
              {pending ? "Savingâ€¦" : "Give money back"}
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
        open={Boolean(payLink)}
        onClose={() => setPayLink(null)}
        title="Payment link ready"
        description={payLink ? `The customer can pay ${formatMoney(payLink.amount, currency, locale)} by UPI, card or net banking.` : ""}
        footer={
          <button type="button" className="btn btn-secondary" onClick={() => setPayLink(null)}>
            Close
          </button>
        }
      >
        {payLink ? (
          <div style={{ display: "grid", gap: 12 }}>
            <input className="input" readOnly value={payLink.url} onFocus={(event) => event.currentTarget.select()} aria-label="Payment link" />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="btn btn-secondary" onClick={copyPayLink}>
                <Icon name="file" /> Copy link
              </button>
              <button type="button" className="btn btn-primary" onClick={sharePayLinkOnWhatsApp}>
                <Icon name="send" /> Send on WhatsApp
              </button>
              <a className="btn btn-ghost" href={payLink.url} target="_blank" rel="noreferrer">
                Open
              </a>
            </div>
            <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
              When the customer pays, this bill updates by itself. You do not need to add the payment.
            </p>
          </div>
        ) : null}
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
          {(["EMAIL", "SMS"] as const).map((channel) => (
            <button key={channel} type="button" className="btn btn-secondary" style={{ justifyContent: "space-between" }} onClick={() => send(channel)} disabled={pending}>
              <span>{channel === "EMAIL" ? "Email the bill" : "Send a text message"}</span>
              <Icon name={channel === "EMAIL" ? "mail" : "send"} />
            </button>
          ))}
          <p className="hint" style={{ margin: "6px 0 0" }}>
            This sends to the customer&apos;s saved email or phone number. To send on WhatsApp to anyone, use
            &quot;Share on WhatsApp&quot;.
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

