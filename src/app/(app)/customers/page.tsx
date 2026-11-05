import type { Metadata } from "next";
import Link from "next/link";
import { requireTenantPage } from "@/lib/guards";
import { hasPermission } from "@/lib/auth";
import { listCustomerStaff, listCustomers } from "@/services/customers";
import { formatDay, formatMoney } from "@/lib/utils";
import { CustomerDialog } from "@/components/customers/customer-dialog";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Customers" };
export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; new?: string }>;
}) {
  const context = await requireTenantPage("customers.read");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const [data, staff] = await Promise.all([
    listCustomers(context, { q: params.q, page, pageSize: 20 }),
    listCustomerStaff(context),
  ]);
  const canWrite = hasPermission(context, "customers.write");

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Customers</h1>
          <p className="page-subtitle">Contact details, visit history, preferences, and balances in one record.</p>
        </div>
        <div className="page-actions">
          {canWrite ? <CustomerDialog triggerLabel="Add customer" staff={staff} autoOpen={params.new === "1"} /> : null}
        </div>
      </div>

      <section className="card">
        <form className="toolbar" method="get">
          <div className="field grow" style={{ maxWidth: 420 }}>
            <label htmlFor="q" className="field-label">Search customers</label>
            <input id="q" name="q" className="input search" defaultValue={params.q || ""} placeholder="Name, phone, email, or tag" />
          </div>
          <button type="submit" className="btn btn-secondary">
            <Icon name="search" /> Search
          </button>
          {params.q ? (
            <Link href="/customers" className="btn btn-ghost">
              Clear
            </Link>
          ) : null}
        </form>
        {data.items.length ? (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th className="hide-mobile">Contact</th>
                    <th className="num hide-mobile">Visits</th>
                    <th className="num">Spent</th>
                    <th className="num hide-mobile">Rewards</th>
                    <th className="hide-mobile">Added</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((customer) => (
                    <tr key={customer.id}>
                      <td>
                        <Link href={`/customers/${customer.id}`} className="link">
                          {customer.name}
                        </Link>
                        {customer.tags.length ? (
                          <div className="chip-row" style={{ marginTop: 4 }}>
                            {customer.tags.slice(0, 3).map((tag) => (
                              <span key={tag} className="chip muted">{tag}</span>
                            ))}
                          </div>
                        ) : customer.preferences ? <div className="cell-sub">{customer.preferences}</div> : null}
                      </td>
                      <td className="hide-mobile">
                        <div>{customer.phone}</div>
                        {customer.email ? <div className="cell-sub">{customer.email}</div> : null}
                      </td>
                      <td className="num hide-mobile">{customer.totalVisits}</td>
                      <td className="num">{formatMoney(customer.totalSpent, context.salon.currency, context.salon.locale)}</td>
                      <td className="num hide-mobile">{customer.loyaltyPoints}</td>
                      <td className="hide-mobile">{formatDay(customer.createdAt, context.salon.timezone, context.salon.locale)}</td>
                      <td>
                        <div className="actions">
                          <Link href={`/customers/${customer.id}`} className="btn btn-ghost btn-sm">
                            Open
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pages={data.pages} total={data.total} basePath="/customers" params={{ q: params.q }} />
          </>
        ) : (
          <EmptyState
            icon="users"
            title={params.q ? "No matching customers" : "No customers yet"}
            message={params.q ? "Try a different name, phone number, or email." : "Add the first customer record to begin booking and invoicing."}
            action={canWrite && !params.q ? <CustomerDialog triggerLabel="Add first customer" staff={staff} /> : null}
          />
        )}
      </section>
    </div>
  );
}
