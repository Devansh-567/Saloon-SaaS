"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, clearUrlParam, errorMessage } from "@/lib/client";
import { formatMoney } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { Icon } from "@/components/ui/icons";

export type ProductRow = {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  price: number;
  cost: number;
  stockQty: number;
  reorderLevel: number;
  unit: string;
  active: boolean;
  supplierId: string | null;
  supplier: string | null;
  taxRateId: string | null;
  taxRate: { name: string; rate: number } | null;
  lowStock: boolean;
};

type Supplier = { id: string; name: string };
type TaxRate = { id: string; name: string; rate: number; active: boolean };

export function NewProductButton({
  suppliers,
  taxRates,
  autoOpen,
}: {
  suppliers: Supplier[];
  taxRates: TaxRate[];
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(autoOpen));
  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        <Icon name="plus" /> New product
      </button>
      {open ? <ProductDialog product={null} suppliers={suppliers} taxRates={taxRates} autoOpen={autoOpen} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function ProductsTable({
  items,
  suppliers,
  taxRates,
  currency,
  locale,
  canWrite,
}: {
  items: ProductRow[];
  suppliers: Supplier[];
  taxRates: TaxRate[];
  currency: string;
  locale: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<{ open: boolean; product: ProductRow | null }>({ open: false, product: null });
  const [stocking, setStocking] = useState<ProductRow | null>(null);
  const [deleting, setDeleting] = useState<ProductRow | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  async function remove() {
    if (!deleting) return;
    setDeletePending(true);
    try {
      const result = await apiRequest<{ archived: boolean }>(`/api/inventory/products/${deleting.id}`, { method: "DELETE" });
      toast.success(result.archived ? "Product archived because it appears in past records." : "Product deleted.");
      setDeleting(null);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Product</th>
              <th className="hide-mobile">Code</th>
              <th className="hide-mobile">Supplier</th>
              <th className="num">Price</th>
              <th className="num hide-mobile">Cost</th>
              <th className="num">Stock</th>
              <th>Status</th>
              {canWrite ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {items.map((product) => (
              <tr key={product.id}>
                <td>
                  <div className="cell-title">{product.name}</div>
                  <div className="cell-sub">
                    {product.taxRate ? `${product.taxRate.name} (${product.taxRate.rate}%)` : "No tax"}
                    {product.description ? ` · ${product.description}` : ""}
                  </div>
                </td>
                <td className="hide-mobile">{product.sku}</td>
                <td className="hide-mobile">{product.supplier || "—"}</td>
                <td className="num">{formatMoney(product.price, currency, locale)}</td>
                <td className="num hide-mobile">{formatMoney(product.cost, currency, locale)}</td>
                <td className="num">
                  <span className={product.lowStock ? "text-danger" : ""}>
                    {product.stockQty} {product.unit}
                  </span>
                  {product.lowStock ? <div className="cell-sub text-danger">Running low (alert at {product.reorderLevel})</div> : null}
                </td>
                <td>
                  <span className={`badge ${product.active ? "badge-success" : "badge-muted"}`}>
                    {product.active ? "Active" : "Inactive"}
                  </span>
                </td>
                {canWrite ? (
                  <td>
                    <div className="actions">
                      <button type="button" className="icon-btn" title="Correct stock count" onClick={() => setStocking(product)}>
                        <Icon name="box" />
                      </button>
                      <button type="button" className="icon-btn" title="Edit product" onClick={() => setEditing({ open: true, product })}>
                        <Icon name="edit" />
                      </button>
                      <button type="button" className="icon-btn" title="Delete or archive product" onClick={() => setDeleting(product)}>
                        <Icon name="trash" />
                      </button>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing.open ? (
        <ProductDialog product={editing.product} suppliers={suppliers} taxRates={taxRates} onClose={() => setEditing({ open: false, product: null })} />
      ) : null}
      {stocking ? <StockDialog product={stocking} onClose={() => setStocking(null)} /> : null}
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title="Delete product?"
        message={
          deleting
            ? deleting.active
              ? `“${deleting.name}” will be removed. If it appears on past bills or stock records, it is archived instead so history stays correct.`
              : `“${deleting.name}” is already inactive. Delete it permanently if it has no history.`
            : ""
        }
        confirmLabel="Delete"
        danger
        pending={deletePending}
      />
    </>
  );
}

export function ProductDialog({
  product,
  suppliers,
  taxRates,
  autoOpen,
  onClose,
}: {
  product: ProductRow | null;
  suppliers: Supplier[];
  taxRates: TaxRate[];
  autoOpen?: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState(product?.active ?? true);

  function close() {
    onClose();
    if (autoOpen) clearUrlParam("new");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      name: form.get("name"),
      sku: form.get("sku"),
      description: form.get("description") || null,
      supplierId: form.get("supplierId") || null,
      taxRateId: form.get("taxRateId") || null,
      price: Number(form.get("price")),
      cost: Number(form.get("cost")),
      reorderLevel: Number(form.get("reorderLevel")),
      unit: form.get("unit"),
      active,
      ...(product ? {} : { stockQty: Number(form.get("stockQty")) }),
    };
    setPending(true);
    setError("");
    try {
      if (product) {
        await apiRequest(`/api/inventory/products/${product.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        toast.success("Product updated.");
      } else {
        await apiRequest("/api/inventory/products", { method: "POST", body: JSON.stringify(payload) });
        toast.success("Product added.");
      }
      close();
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
      onClose={close}
      title={product ? "Edit product" : "New product"}
      wide
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={close} disabled={pending}>Cancel</button>
          <button type="submit" form="product-form" className="btn btn-primary" disabled={pending}>
            {pending ? "Saving…" : product ? "Save changes" : "Add product"}
          </button>
        </>
      }
    >
      {error ? <div className="alert alert-error">{error}</div> : null}
      <form id="product-form" onSubmit={submit}>
        <div className="form-grid">
          <div className="field span-2">
            <label htmlFor="product-name">Product name</label>
            <input id="product-name" name="name" className="input" defaultValue={product?.name || ""} required maxLength={120} autoFocus />
          </div>
          <div className="field">
            <label htmlFor="product-sku">Product code</label>
            <input id="product-sku" name="sku" className="input" defaultValue={product?.sku || ""} required maxLength={60} />
          </div>
          <div className="field">
            <label htmlFor="product-unit">Unit</label>
            <input id="product-unit" name="unit" className="input" defaultValue={product?.unit || "unit"} required maxLength={30} />
          </div>
          <div className="field">
            <label htmlFor="product-price">Retail price</label>
            <input id="product-price" name="price" type="number" min={0} step="0.01" className="input" defaultValue={product?.price ?? ""} required />
          </div>
          <div className="field">
            <label htmlFor="product-cost">Cost</label>
            <input id="product-cost" name="cost" type="number" min={0} step="0.01" className="input" defaultValue={product?.cost ?? 0} required />
          </div>
          {product ? null : (
            <div className="field">
              <label htmlFor="product-stock">Opening stock</label>
              <input id="product-stock" name="stockQty" type="number" min={0} className="input" defaultValue={0} />
            </div>
          )}
          <div className="field">
            <label htmlFor="product-reorder">Alert me when stock is below</label>
            <input id="product-reorder" name="reorderLevel" type="number" min={0} className="input" defaultValue={product?.reorderLevel ?? 0} />
          </div>
          <div className="field">
            <label htmlFor="product-supplier">Supplier</label>
            <select id="product-supplier" name="supplierId" className="select" defaultValue={product?.supplierId || ""}>
              <option value="">None</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="product-tax">Tax rate</label>
            <select id="product-tax" name="taxRateId" className="select" defaultValue={product?.taxRateId || ""}>
              <option value="">No tax</option>
              {taxRates.map((tax) => (
                <option key={tax.id} value={tax.id}>{tax.name} ({tax.rate}%)</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="product-active">Status</label>
            <label className="switch">
              <input id="product-active" type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
              <span>Available for sale</span>
            </label>
          </div>
          <div className="field span-2">
            <label htmlFor="product-description">Description</label>
            <textarea id="product-description" name="description" className="textarea" defaultValue={product?.description || ""} />
          </div>
        </div>
      </form>
    </Modal>
  );
}

function StockDialog({ product, onClose }: { product: ProductRow; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"add" | "remove">("add");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const quantity = Math.abs(Number(form.get("quantity")));
    if (!quantity) {
      setError("Enter a quantity.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await apiRequest("/api/inventory/adjustments", {
        method: "POST",
        body: JSON.stringify({
          productId: product.id,
          delta: mode === "add" ? quantity : -quantity,
          notes: form.get("notes"),
        }),
      });
      toast.success("Stock adjusted.");
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
      title={`Correct stock count · ${product.name}`}
      description={`Current stock: ${product.stockQty} ${product.unit}`}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>Cancel</button>
          <button type="submit" form="stock-form" className="btn btn-primary" disabled={pending}>
            {pending ? "Saving…" : "Apply adjustment"}
          </button>
        </>
      }
    >
      {error ? <div className="alert alert-error">{error}</div> : null}
      <form id="stock-form" onSubmit={submit}>
        <div className="segmented" style={{ marginBottom: 14 }}>
          <button type="button" className={mode === "add" ? "active" : ""} onClick={() => setMode("add")}>
            <Icon name="arrowUp" /> Receive
          </button>
          <button type="button" className={mode === "remove" ? "active" : ""} onClick={() => setMode("remove")}>
            <Icon name="arrowDown" /> Remove
          </button>
        </div>
        <div className="form-grid">
          <div className="field span-2">
            <label htmlFor="stock-quantity">Quantity ({product.unit})</label>
            <input id="stock-quantity" name="quantity" type="number" min={1} className="input" required autoFocus />
          </div>
          <div className="field span-2">
            <label htmlFor="stock-notes">Reason</label>
            <input id="stock-notes" name="notes" className="input" placeholder="Stock count correction, damaged, back-of-house use…" required minLength={2} />
          </div>
        </div>
      </form>
    </Modal>
  );
}
