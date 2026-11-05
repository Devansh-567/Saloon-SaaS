import type { Metadata } from "next";
import Link from "next/link";
import { requireTenantPage } from "@/lib/guards";
import { getCustomer } from "@/services/customers";
import { getSalonSettingsData } from "@/services/salon-config";
import { listAllProducts } from "@/services/inventory";
import { InvoiceBuilder } from "@/components/billing/invoice-builder";
import { Icon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "New Bill" };
export const dynamic = "force-dynamic";

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const context = await requireTenantPage("billing.write");
  const params = await searchParams;
  const [settings, products, customer] = await Promise.all([
    getSalonSettingsData(context),
    listAllProducts(context),
    params.customer ? getCustomer(context, params.customer) : Promise.resolve(null),
  ]);

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link href="/billing" className="icon-btn" aria-label="Back to billing">
            <Icon name="arrow" style={{ transform: "rotate(180deg)" }} />
          </Link>
          <div>
            <h1 style={{ marginBottom: 2 }}>New Bill</h1>
            <p className="page-subtitle">Pick services and products, give a discount if needed, take payment, and finish.</p>
          </div>
        </div>
      </div>
      <InvoiceBuilder
        services={settings.services}
        products={products}
        staff={settings.staff}
        branches={settings.branches}
        initialCustomer={customer ? { id: customer.id, name: customer.name, phone: customer.phone, email: customer.email } : null}
        currency={context.salon.currency}
        locale={context.salon.locale}
      />
    </div>
  );
}
