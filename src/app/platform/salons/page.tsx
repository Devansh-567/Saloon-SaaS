import type { Metadata } from "next";
import Link from "next/link";
import { SalonStatus } from "@prisma/client";
import { listPlatformSalons, listPlans } from "@/services/platform";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icons";
import { SalonsPanel } from "@/components/platform/salons-panel";

export const metadata: Metadata = { title: "Salons" };
export const dynamic = "force-dynamic";

export default async function PlatformSalonsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const status = Object.values(SalonStatus).includes(params.status as SalonStatus) ? (params.status as SalonStatus) : undefined;
  const [data, plans] = await Promise.all([
    listPlatformSalons({ q: params.q, status, page, pageSize: 20 }),
    listPlans(),
  ]);

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Salons</h1>
          <p className="page-subtitle">{data.total} businesses on the platform.</p>
        </div>
      </div>

      <section className="card">
        <form className="toolbar" method="get">
          <div className="field grow" style={{ maxWidth: 380 }}>
            <label className="field-label" htmlFor="q">Search</label>
            <input id="q" name="q" className="input search" defaultValue={params.q || ""} placeholder="Salon, owner, or email" />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="status">Status</label>
            <select id="status" name="status" className="select" defaultValue={params.status || ""}>
              <option value="">All statuses</option>
              {Object.values(SalonStatus).map((value) => (
                <option key={value} value={value}>{value.replaceAll("_", " ").toLowerCase()}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-secondary">
            <Icon name="filter" /> Apply
          </button>
          {params.q || params.status ? (
            <Link href="/platform/salons" className="btn btn-ghost">Clear</Link>
          ) : null}
        </form>

        {data.items.length ? (
          <>
            <SalonsPanel salons={data.items} plans={plans.map((plan) => ({ id: plan.id, name: plan.name, active: plan.active }))} />
            <Pagination page={page} pages={data.pages} total={data.total} basePath="/platform/salons" params={{ q: params.q, status: params.status }} />
          </>
        ) : (
          <EmptyState
            icon="building"
            title="No salons found"
            message={params.q || params.status ? "Try a different search or clear the status filter." : "Onboard the first salon to get started."}
          />
        )}
      </section>
    </div>
  );
}
