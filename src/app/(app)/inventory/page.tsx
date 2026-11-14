import type { Metadata } from "next";
import Link from "next/link";
import { requireTenantPage } from "@/lib/guards";
import { hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listAllProducts, listProducts, listPurchaseHistory, listSuppliers } from "@/services/inventory";
import { formatDate, formatMoney, asNumber } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icons";
import { NewProductButton, ProductsTable } from "@/components/inventory/product-dialogs";
import { SuppliersSection } from "@/components/inventory/suppliers-section";
import { PurchaseButton } from "@/components/inventory/purchase-dialog";
import { PurchaseActions } from "@/components/inventory/purchase-actions";

export const metadata: Metadata = { title: "Inventory" };
export const dynamic = "force-dynamic";

const TABS = [
  { id: "products", label: "Products" },
  { id: "suppliers", label: "Suppliers" },
  { id: "purchases", label: "Stock bought" },
] as const;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; lowStock?: string; page?: string; new?: string }>;
}) {
  const context = await requireTenantPage("inventory.read");
  const params = await searchParams;
  const tab = TABS.some((item) => item.id === params.tab) ? (params.tab as (typeof TABS)[number]["id"]) : "products";
  const page = Math.max(1, Number(params.page) || 1);
  const canWrite = hasPermission(context, "inventory.write");
  const lowStockOnly = params.lowStock === "1";

  const [suppliers, taxRates] = await Promise.all([
    listSuppliers(context),
    prisma.taxRate.findMany({ where: { salonId: context.salon.id }, orderBy: { name: "asc" } }),
  ]);
  const taxOptions = taxRates.map((tax) => ({ id: tax.id, name: tax.name, rate: asNumber(tax.rate), active: tax.active }));
  const supplierOptions = suppliers.map((supplier) => ({ id: supplier.id, name: supplier.name }));

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Inventory</h1>
          <p className="page-subtitle">Retail and back-bar stock, suppliers, and purchase history in one ledger.</p>
        </div>
        {tab === "products" && canWrite ? (
          <div className="page-actions">
            <NewProductButton suppliers={supplierOptions} taxRates={taxOptions} autoOpen={params.new === "1"} />
          </div>
        ) : null}
      </div>

      <div className="tabs">
        {TABS.map((item) => (
          <Link key={item.id} href={`/inventory?tab=${item.id}`} className={`tab ${tab === item.id ? "active" : ""}`}>
            {item.label}
          </Link>
        ))}
      </div>

      {tab === "products" ? (
        <ProductsTab
          q={params.q}
          lowStockOnly={lowStockOnly}
          page={page}
          supplierOptions={supplierOptions}
          taxOptions={taxOptions}
          currency={context.salon.currency}
          locale={context.salon.locale}
          canWrite={canWrite}
        />
      ) : null}
      {tab === "suppliers" ? <SuppliersSection suppliers={suppliers} canWrite={canWrite} /> : null}
      {tab === "purchases" ? (
        <PurchasesTab
          canWrite={canWrite}
          page={page}
          currency={context.salon.currency}
          locale={context.salon.locale}
          timezone={context.salon.timezone}
          supplierOptions={supplierOptions}
        />
      ) : null}
    </div>
  );
}

async function ProductsTab({
  q,
  lowStockOnly,
  page,
  supplierOptions,
  taxOptions,
  currency,
  locale,
  canWrite,
}: {
  q?: string;
  lowStockOnly: boolean;
  page: number;
  supplierOptions: Array<{ id: string; name: string }>;
  taxOptions: Array<{ id: string; name: string; rate: number; active: boolean }>;
  currency: string;
  locale: string;
  canWrite: boolean;
}) {
  const context = await requireTenantPage("inventory.read");
  const data = await listProducts(context, { q, lowStock: lowStockOnly, page, pageSize: 20 });

  return (
    <section className="card">
      <form className="toolbar" method="get">
        <input type="hidden" name="tab" value="products" />
        <div className="field grow" style={{ maxWidth: 320 }}>
          <label className="field-label" htmlFor="q">Search</label>
          <input id="q" name="q" className="input search" defaultValue={q || ""} placeholder="Product name or code" />
        </div>
        <label className="checkbox">
          <input type="checkbox" name="lowStock" value="1" defaultChecked={lowStockOnly} />
          <span>Low stock only</span>
        </label>
        <button type="submit" className="btn btn-secondary">
          <Icon name="filter" /> Apply
        </button>
        {q || lowStockOnly ? (
          <Link href="/inventory?tab=products" className="btn btn-ghost">Clear</Link>
        ) : null}
      </form>
      {data.items.length ? (
        <>
          <ProductsTable items={data.items} suppliers={supplierOptions} taxRates={taxOptions} currency={currency} locale={locale} canWrite={canWrite} />
          <Pagination
            page={page}
            pages={data.pages}
            total={data.total}
            basePath="/inventory"
            params={{ tab: "products", q, lowStock: lowStockOnly ? "1" : undefined }}
          />
        </>
      ) : (
        <EmptyState
          icon="box"
          title={q || lowStockOnly ? "No matching products" : "No products yet"}
          message={q || lowStockOnly ? "Try a broader search or clear the low-stock filter." : "Add retail products and back-bar consumables to track stock and costs."}
        />
      )}
    </section>
  );
}

async function PurchasesTab({
  canWrite,
  page,
  currency,
  locale,
  timezone,
  supplierOptions,
}: {
  canWrite: boolean;
  page: number;
  currency: string;
  locale: string;
  timezone: string;
  supplierOptions: Array<{ id: string; name: string }>;
}) {
  const context = await requireTenantPage("inventory.read");
  const [history, products] = await Promise.all([listPurchaseHistory(context, page, 20), listAllProducts(context)]);

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>Stock bought history</h2>
          <p>Every stock receipt, with supplier and unit costs.</p>
        </div>
        {canWrite ? (
          <PurchaseButton
            products={products.map((product) => ({ id: product.id, name: product.name, unit: product.unit, cost: product.cost, active: product.active }))}
            suppliers={supplierOptions}
            currency={currency}
            locale={locale}
            timezone={timezone}
          />
        ) : null}
      </div>
      {history.items.length ? (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Reference</th>
                  <th className="hide-mobile">Items</th>
                  <th className="num">Total</th>
                  {canWrite ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {history.items.map((purchase) => (
                  <tr key={purchase.id}>
                    <td>{formatDate(purchase.purchasedAt, context.salon.timezone, context.salon.locale)}</td>
                    <td>{purchase.supplier || "—"}</td>
                    <td>{purchase.reference || "—"}</td>
                    <td className="hide-mobile">
                      {purchase.items.map((item) => `${item.product} ×${item.quantity} @ ${formatMoney(item.unitCost, currency, locale)}`).join(", ")}
                    </td>
                    <td className="num">{formatMoney(purchase.total, currency, locale)}</td>
                    {canWrite ? (
                      <td>
                        <PurchaseActions
                          id={purchase.id}
                          reference={purchase.reference || "This purchase"}
                          total={formatMoney(purchase.total, currency, locale)}
                        />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pages={history.pages} total={history.total} basePath="/inventory" params={{ tab: "purchases" }} />
        </>
      ) : (
        <EmptyState
          icon="box"
          title="No purchases recorded"
          message="Recording purchases keeps stock counts and product costs accurate."
        />
      )}
    </section>
  );
}
