import type { Metadata } from "next";
import { requireTenantPage } from "@/lib/guards";
import { hasPermission } from "@/lib/auth";
import { getSalonSettingsData } from "@/services/salon-config";
import { listAllProducts } from "@/services/inventory";
import { ServicesPanel } from "@/components/services/services-panel";

export const metadata: Metadata = { title: "Services & pricing" };
export const dynamic = "force-dynamic";

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const context = await requireTenantPage("services.read");
  const params = await searchParams;
  const [settings, products] = await Promise.all([getSalonSettingsData(context), listAllProducts(context)]);

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Services &amp; pricing</h1>
          <p className="page-subtitle">Your price list for appointments and bills.</p>
        </div>
      </div>
      <ServicesPanel
        services={settings.services}
        categories={settings.categories.map((category) => ({ id: category.id, name: category.name }))}
        taxRates={settings.taxRates.map((tax) => ({ id: tax.id, name: tax.name, rate: tax.rate, active: tax.active }))}
        products={products.map((product) => ({ id: product.id, name: product.name, unit: product.unit, active: product.active }))}
        currency={context.salon.currency}
        locale={context.salon.locale}
        canWrite={hasPermission(context, "services.write")}
        autoOpen={params.new === "1"}
      />
    </div>
  );
}
