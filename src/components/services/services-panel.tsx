"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, clearUrlParam, errorMessage } from "@/lib/client";
import { formatMoney } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icons";

type Service = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  durationMin: number;
  active: boolean;
  commissionRate: number | null;
  category: { id: string; name: string } | null;
  taxRate: { id: string; name: string; rate: number } | null;
  productUsage: Array<{ productId: string; quantity: number; name: string; unit: string }>;
};

type Category = { id: string; name: string };
type TaxRate = { id: string; name: string; rate: number; active: boolean };
type Product = { id: string; name: string; unit: string; active: boolean };

export function ServicesPanel({
  services,
  categories,
  taxRates,
  products,
  currency,
  locale,
  canWrite,
  autoOpen,
}: {
  services: Service[];
  categories: Category[];
  taxRates: TaxRate[];
  products: Product[];
  currency: string;
  locale: string;
  canWrite: boolean;
  autoOpen?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editing, setEditing] = useState<{ open: boolean; service: Service | null }>({ open: Boolean(autoOpen), service: null });
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [taxesOpen, setTaxesOpen] = useState(false);
  const [toggling, setToggling] = useState<Service | null>(null);
  const [pending, setPending] = useState(false);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return services.filter((service) => {
      if (text && !service.name.toLowerCase().includes(text) && !(service.description || "").toLowerCase().includes(text)) return false;
      if (categoryFilter === "none" && service.category) return false;
      if (categoryFilter && categoryFilter !== "none" && service.category?.id !== categoryFilter) return false;
      if (statusFilter === "active" && !service.active) return false;
      if (statusFilter === "inactive" && service.active) return false;
      return true;
    });
  }, [services, query, categoryFilter, statusFilter]);

  function closeEditor() {
    setEditing({ open: false, service: null });
    if (autoOpen) clearUrlParam("new");
  }

  async function toggleService() {
    if (!toggling) return;
    setPending(true);
    try {
      await apiRequest(`/api/services/${toggling.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !toggling.active }),
      });
      toast.success(toggling.active ? `${toggling.name} deactivated.` : `${toggling.name} activated.`);
      setToggling(null);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <section className="card">
        <form className="toolbar" onSubmit={(event) => event.preventDefault()}>
          <div className="field grow" style={{ maxWidth: 320 }}>
            <label className="field-label" htmlFor="service-search">Search</label>
            <input id="service-search" className="input search" placeholder="Service name" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="service-category">Category</label>
            <select id="service-category" className="select" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
              <option value="none">Uncategorized</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="service-status">Status</label>
            <select id="service-status" className="select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          {canWrite ? (
            <div className="toolbar-actions">
              <button type="button" className="btn btn-primary" onClick={() => setEditing({ open: true, service: null })}>
                <Icon name="plus" /> New service
              </button>
            </div>
          ) : null}
        </form>

        {filtered.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Category</th>
                  <th className="num">Duration</th>
                  <th className="num">Price</th>
                  <th className="hide-mobile">Tax</th>
                  <th className="hide-mobile num">Commission</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((service) => (
                  <tr key={service.id}>
                    <td>
                      <div className="cell-title">{service.name}</div>
                      {service.productUsage.length ? (
                        <div className="cell-sub">
                          Uses {service.productUsage.map((usage) => `${usage.name} ×${usage.quantity}`).join(", ")}
                        </div>
                      ) : service.description ? (
                        <div className="cell-sub">{service.description}</div>
                      ) : null}
                    </td>
                    <td>{service.category?.name || "—"}</td>
                    <td className="num">{service.durationMin} min</td>
                    <td className="num">{formatMoney(service.price, currency, locale)}</td>
                    <td className="hide-mobile">{service.taxRate ? `${service.taxRate.name} (${service.taxRate.rate}%)` : "—"}</td>
                    <td className="hide-mobile num">{service.commissionRate === null ? "—" : `${service.commissionRate}%`}</td>
                    <td>
                      <span className={`badge ${service.active ? "badge-success" : "badge-muted"}`}>
                        {service.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className="actions">
                        {canWrite ? (
                          <>
                            <button type="button" className="icon-btn" title="Edit service" onClick={() => setEditing({ open: true, service })}>
                              <Icon name="edit" />
                            </button>
                            <button type="button" className="icon-btn" title={service.active ? "Deactivate" : "Activate"} onClick={() => setToggling(service)}>
                              <Icon name={service.active ? "pause" : "play"} />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon="service"
            title={services.length ? "No matching services" : "No services yet"}
            message={services.length ? "Try a different search to find the service." : "Add the treatments and packages you sell so they can be booked and invoiced."}
            action={canWrite ? <button type="button" className="btn btn-primary" onClick={() => setEditing({ open: true, service: null })}>Add service</button> : null}
          />
        )}
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Categories</h2>
              <p>Group services for faster booking and cleaner reports.</p>
            </div>
            {canWrite ? (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCategoriesOpen(true)}>
                <Icon name="edit" /> Manage
              </button>
            ) : null}
          </div>
          <div className="card-body">
            {categories.length ? (
              <div className="chip-row">
                {categories.map((category) => (
                  <span key={category.id} className="chip">
                    {category.name}
                    <span className="badge badge-plain">{services.filter((service) => service.category?.id === category.id).length}</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="hint" style={{ margin: 0 }}>No categories yet.</p>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2>Tax rates</h2>
              <p>Added on bills for each service or product.</p>
            </div>
            {canWrite ? (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTaxesOpen(true)}>
                <Icon name="edit" /> Manage
              </button>
            ) : null}
          </div>
          <div className="card-body">
            {taxRates.length ? (
              <div className="chip-row">
                {taxRates.map((tax) => (
                  <span key={tax.id} className={`chip ${tax.active ? "" : "muted"}`}>
                    {tax.name}
                    <span className="badge badge-plain">{tax.rate}%</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="hint" style={{ margin: 0 }}>No tax added yet. Bills will have no tax.</p>
            )}
          </div>
        </section>
      </div>

      {editing.open ? (
        <ServiceDialog
          service={editing.service}
          categories={categories}
          taxRates={taxRates.filter((tax) => tax.active || tax.id === editing.service?.taxRate?.id)}
          products={products.filter((product) => product.active)}
          onClose={closeEditor}
        />
      ) : null}

      {categoriesOpen ? <CategoriesDialog categories={categories} onClose={() => setCategoriesOpen(false)} /> : null}
      {taxesOpen ? <TaxesDialog taxRates={taxRates} onClose={() => setTaxesOpen(false)} /> : null}

      <ConfirmDialog
        open={Boolean(toggling)}
        onClose={() => setToggling(null)}
        onConfirm={toggleService}
        title={toggling?.active ? "Deactivate service?" : "Activate service?"}
        message={
          toggling?.active
            ? "Old appointments and bills keep this service, but it cannot be picked for new ones."
            : "The service becomes available for booking and invoicing again."
        }
        confirmLabel={toggling?.active ? "Deactivate" : "Activate"}
        pending={pending}
      />
    </>
  );
}

function ServiceDialog({
  service,
  categories,
  taxRates,
  products,
  onClose,
}: {
  service: Service | null;
  categories: Category[];
  taxRates: TaxRate[];
  products: Product[];
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [usage, setUsage] = useState<Array<{ productId: string; quantity: number }>>(
    service?.productUsage.map((item) => ({ productId: item.productId, quantity: item.quantity })) || [],
  );
  const [active, setActive] = useState(service?.active ?? true);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      name: form.get("name"),
      description: form.get("description") || null,
      categoryId: form.get("categoryId") || null,
      taxRateId: form.get("taxRateId") || null,
      price: Number(form.get("price")),
      durationMin: Number(form.get("durationMin")),
      commissionRate: form.get("commissionRate") === "" ? null : Number(form.get("commissionRate")),
      active,
      productUsage: usage.filter((item) => item.productId),
    };
    setPending(true);
    setError("");
    try {
      if (service) {
        await apiRequest(`/api/services/${service.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        toast.success("Service updated.");
      } else {
        await apiRequest("/api/services", { method: "POST", body: JSON.stringify(payload) });
        toast.success("Service created.");
      }
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
      title={service ? "Edit service" : "New service"}
      description="Pricing, duration, tax, and the products consumed during the treatment."
      wide
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>Cancel</button>
          <button type="submit" form="service-form" className="btn btn-primary" disabled={pending}>
            {pending ? "Saving…" : service ? "Save changes" : "Create service"}
          </button>
        </>
      }
    >
      {error ? <div className="alert alert-error">{error}</div> : null}
      <form id="service-form" onSubmit={submit}>
        <div className="form-grid">
          <div className="field span-2">
            <label htmlFor="name">Service name</label>
            <input id="name" name="name" className="input" defaultValue={service?.name || ""} required maxLength={120} autoFocus />
          </div>
          <div className="field">
            <label htmlFor="price">Price</label>
            <input id="price" name="price" type="number" min={0} step="0.01" className="input" defaultValue={service?.price ?? ""} required />
          </div>
          <div className="field">
            <label htmlFor="durationMin">Duration (minutes)</label>
            <input id="durationMin" name="durationMin" type="number" min={5} max={1440} className="input" defaultValue={service?.durationMin ?? 30} required />
          </div>
          <div className="field">
            <label htmlFor="categoryId">Category</label>
            <select id="categoryId" name="categoryId" className="select" defaultValue={service?.category?.id || ""}>
              <option value="">Uncategorized</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="taxRateId">Tax rate</label>
            <select id="taxRateId" name="taxRateId" className="select" defaultValue={service?.taxRate?.id || ""}>
              <option value="">No tax</option>
              {taxRates.map((tax) => (
                <option key={tax.id} value={tax.id}>{tax.name} ({tax.rate}%)</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="commissionRate">Commission override (%)</label>
            <input id="commissionRate" name="commissionRate" type="number" min={0} max={100} step="0.1" className="input" defaultValue={service?.commissionRate ?? ""} placeholder="Staff default" />
          </div>
          <div className="field">
            <label htmlFor="active">Status</label>
            <label className="switch">
              <input id="active" type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
              <span>Available for booking</span>
            </label>
          </div>
          <div className="field span-2">
            <label htmlFor="description">Description</label>
            <textarea id="description" name="description" className="textarea" defaultValue={service?.description || ""} />
          </div>
        </div>

        <div className="section-divider">
          <div className="row-between">
            <div>
              <strong>Products used</strong>
              <p className="hint" style={{ margin: "2px 0 0" }}>Stock is deducted automatically when the service is delivered through an appointment.</p>
            </div>
            {products.length ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setUsage((current) => [...current, { productId: "", quantity: 1 }])}
              >
                <Icon name="plus" /> Add product
              </button>
            ) : null}
          </div>
          {products.length ? (
            usage.length ? (
              <div className="stack" style={{ marginTop: 10 }}>
                {usage.map((item, index) => (
                  <div className="inline-row" key={index}>
                    <select
                      className="select"
                      value={item.productId}
                      onChange={(event) =>
                        setUsage((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, productId: event.target.value } : row)))
                      }
                      required
                    >
                      <option value="">Choose product</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>{product.name} ({product.unit})</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      className="input"
                      style={{ width: 90 }}
                      min={1}
                      value={item.quantity}
                      onChange={(event) =>
                        setUsage((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, quantity: Math.max(1, Number(event.target.value) || 1) } : row)))
                      }
                    />
                    <button type="button" className="icon-btn" aria-label="Remove product" onClick={() => setUsage((current) => current.filter((_, rowIndex) => rowIndex !== index))}>
                      <Icon name="trash" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="hint" style={{ marginTop: 10 }}>No products linked. The service will not consume stock.</p>
            )
          ) : (
            <p className="hint" style={{ marginTop: 10 }}>Add products in Inventory first to link stock consumption.</p>
          )}
        </div>
      </form>
    </Modal>
  );
}

function CategoriesDialog({ categories, onClose }: { categories: Category[]; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [removing, setRemoving] = useState<Category | null>(null);
  const [error, setError] = useState("");

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      await apiRequest("/api/service-categories", { method: "POST", body: JSON.stringify({ name }) });
      toast.success("Category added.");
      setName("");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function remove(category: Category) {
    setPending(true);
    try {
      await apiRequest(`/api/service-categories/${category.id}`, { method: "DELETE" });
      toast.success("Category removed.");
      setRemoving(null);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Service categories"
      description="Categories help receptionists find services quickly."
      footer={<button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>}
    >
      {error ? <div className="alert alert-error">{error}</div> : null}
      <form onSubmit={add} className="inline-row" style={{ marginBottom: 14 }}>
        <input className="input" placeholder="Category name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} />
        <button type="submit" className="btn btn-primary" disabled={pending || !name.trim()}>
          <Icon name="plus" /> Add
        </button>
      </form>
      {categories.length ? (
        <ul className="simple-list">
          {categories.map((category) => (
            <li key={category.id}>
              <span>{category.name}</span>
              <button type="button" className="icon-btn" aria-label={`Delete ${category.name}`} onClick={() => setRemoving(category)}>
                <Icon name="trash" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">No categories yet.</p>
      )}
      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove(removing)}
        title="Delete category?"
        message={removing ? `Services in “${removing.name}” become uncategorized. This cannot be undone.` : ""}
        confirmLabel="Delete"
        danger
        pending={pending}
      />
    </Modal>
  );
}

function TaxesDialog({ taxRates, onClose }: { taxRates: TaxRate[]; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [rate, setRate] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      await apiRequest("/api/tax-rates", { method: "POST", body: JSON.stringify({ name, rate: Number(rate), active: true }) });
      toast.success("Tax rate added.");
      setName("");
      setRate("");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function toggle(tax: TaxRate) {
    setPending(true);
    try {
      await apiRequest(`/api/tax-rates/${tax.id}`, { method: "PATCH", body: JSON.stringify({ active: !tax.active }) });
      toast.success("Tax rate updated.");
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Tax rates"
      description="Set the rates that apply to services and retail products."
      footer={<button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>}
    >
      {error ? <div className="alert alert-error">{error}</div> : null}
      <form onSubmit={add} className="inline-row" style={{ marginBottom: 14 }}>
        <input className="input" placeholder="Name (e.g. VAT)" value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} />
        <input className="input" type="number" min={0} max={100} step="0.01" placeholder="Rate %" value={rate} onChange={(event) => setRate(event.target.value)} required style={{ width: 110 }} />
        <button type="submit" className="btn btn-primary" disabled={pending || !name.trim() || rate === ""}>
          <Icon name="plus" /> Add
        </button>
      </form>
      {taxRates.length ? (
        <ul className="simple-list">
          {taxRates.map((tax) => (
            <li key={tax.id}>
              <span>
                {tax.name} <span className="badge badge-plain">{tax.rate}%</span>
              </span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggle(tax)} disabled={pending}>
                {tax.active ? "Deactivate" : "Activate"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">No tax added yet. Bills will have no tax.</p>
      )}
    </Modal>
  );
}
