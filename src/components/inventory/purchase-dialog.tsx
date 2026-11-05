"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, errorMessage } from "@/lib/client";
import { formatMoney, roundMoney } from "@/lib/utils";
import { zonedDateInput } from "@/lib/timezone";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { Icon } from "@/components/ui/icons";

type Product = { id: string; name: string; unit: string; cost: number; active: boolean };
type Supplier = { id: string; name: string };

type Line = { key: number; productId: string; quantity: number; unitCost: number };

let lineKey = 1;

export function PurchaseButton({
  products,
  suppliers,
  currency,
  locale,
  timezone,
}: {
  products: Product[];
  suppliers: Supplier[];
  currency: string;
  locale: string;
  timezone: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        <Icon name="plus" /> Record purchase
      </button>
      {open ? (
        <PurchaseDialog products={products} suppliers={suppliers} currency={currency} locale={locale} timezone={timezone} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

function PurchaseDialog({
  products,
  suppliers,
  currency,
  locale,
  timezone,
  onClose,
}: {
  products: Product[];
  suppliers: Supplier[];
  currency: string;
  locale: string;
  timezone: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [lines, setLines] = useState<Line[]>([{ key: lineKey++, productId: "", quantity: 1, unitCost: 0 }]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const total = roundMoney(lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0));

  function updateLine(key: number, patch: Partial<Line>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payloadLines = lines
      .filter((line) => line.productId)
      .map((line) => ({ productId: line.productId, quantity: line.quantity, unitCost: line.unitCost }));
    if (!payloadLines.length) {
      setError("Add at least one product line.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await apiRequest("/api/inventory/purchases", {
        method: "POST",
        body: JSON.stringify({
          supplierId: form.get("supplierId") || null,
          reference: form.get("reference") || null,
          purchasedAt: form.get("purchasedAt"),
          notes: form.get("notes") || null,
          items: payloadLines,
        }),
      });
      toast.success("Saved. Stock updated.");
      onClose();
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Record purchase"
      description="Stock is received and product costs are updated to the latest unit cost."
      wide
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>Cancel</button>
          <button type="submit" form="purchase-form" className="btn btn-primary" disabled={pending}>
            {pending ? "Saving…" : `Record purchase · ${formatMoney(total, currency, locale)}`}
          </button>
        </>
      }
    >
      {error ? <div className="alert alert-error">{error}</div> : null}
      <form id="purchase-form" onSubmit={submit}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="purchase-supplier">Supplier</label>
            <select id="purchase-supplier" name="supplierId" className="select">
              <option value="">None</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="purchase-date">Date bought</label>
            <input id="purchase-date" name="purchasedAt" type="date" className="input" defaultValue={zonedDateInput(new Date(), timezone)} required />
          </div>
          <div className="field span-2">
            <label htmlFor="purchase-reference">Reference</label>
            <input id="purchase-reference" name="reference" className="input" placeholder="Supplier's bill number" maxLength={100} />
          </div>
        </div>
        <div className="section-divider">
          <div className="row-between">
            <strong>Items</strong>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setLines((current) => [...current, { key: lineKey++, productId: "", quantity: 1, unitCost: 0 }])}>
              <Icon name="plus" /> Add item
            </button>
          </div>
          <div className="stack" style={{ marginTop: 10 }}>
            {lines.map((line) => (
              <div className="line-item" key={line.key}>
                <div className="field">
                  <label className="field-label">Product</label>
                  <select
                    className="select"
                    value={line.productId}
                    onChange={(event) => {
                      const product = productMap.get(event.target.value);
                      updateLine(line.key, { productId: event.target.value, unitCost: product?.cost || 0 });
                    }}
                    required
                  >
                    <option value="">Choose product</option>
                    {products.filter((product) => product.active).map((product) => (
                      <option key={product.id} value={product.id}>{product.name} ({product.unit})</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">Quantity</label>
                  <input type="number" className="input" min={1} value={line.quantity} onChange={(event) => updateLine(line.key, { quantity: Math.max(1, Number(event.target.value) || 1) })} />
                </div>
                <div className="field">
                  <label className="field-label">Unit cost</label>
                  <input type="number" className="input" min={0} step="0.01" value={line.unitCost} onChange={(event) => updateLine(line.key, { unitCost: Math.max(0, Number(event.target.value) || 0) })} />
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                  <div className="line-item-total">{formatMoney(roundMoney(line.quantity * line.unitCost), currency, locale)}</div>
                  <button type="button" className="icon-btn" aria-label="Remove item" onClick={() => setLines((current) => (current.length > 1 ? current.filter((row) => row.key !== line.key) : current))}>
                    <Icon name="trash" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="totals-box" style={{ marginTop: 14 }}>
            <div className="grand">
              <span>Total cost</span>
              <span>{formatMoney(total, currency, locale)}</span>
            </div>
          </div>
        </div>
        <div className="field" style={{ marginTop: 14 }}>
          <label htmlFor="purchase-notes">Notes</label>
          <textarea id="purchase-notes" name="notes" className="textarea" />
        </div>
      </form>
    </Modal>
  );
}
