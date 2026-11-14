"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, errorMessage } from "@/lib/client";
import { formatMoney, slugify } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { Icon } from "@/components/ui/icons";

type PlanRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  monthlyPrice: number;
  yearlyPrice: number | null;
  features: string[];
  limits: { maxBranches?: number; maxStaff?: number };
  active: boolean;
  subscriptions: number;
};

export function PlansPanel({ plans }: { plans: PlanRow[] }) {
  const [editing, setEditing] = useState<{ open: boolean; plan: PlanRow | null }>({ open: false, plan: null });

  return (
    <>
      <section className="card">
        <div className="card-head">
          <div>
            <h2>Subscription plans</h2>
            <p>Prices are platform list prices; limits gate branches and staff.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setEditing({ open: true, plan: null })}>
            <Icon name="plus" /> New plan
          </button>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Plan</th>
                <th className="num">Monthly</th>
                <th className="num hide-mobile">Yearly</th>
                <th className="hide-mobile">Limits</th>
                <th className="num hide-mobile">Salons</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id}>
                  <td>
                    <div className="cell-title">{plan.name}</div>
                    <div className="cell-sub">
                      /{plan.slug} · {plan.features.length} feature{plan.features.length === 1 ? "" : "s"}
                      {plan.description ? ` · ${plan.description}` : ""}
                    </div>
                  </td>
                  <td className="num">{formatMoney(plan.monthlyPrice, "INR", "en-IN")}</td>
                  <td className="num hide-mobile">{plan.yearlyPrice === null ? "—" : formatMoney(plan.yearlyPrice, "INR", "en-IN")}</td>
                  <td className="hide-mobile">
                    {plan.limits.maxStaff || "∞"} staff · {plan.limits.maxBranches || "∞"} branches
                  </td>
                  <td className="num hide-mobile">{plan.subscriptions}</td>
                  <td>
                    <span className={`badge ${plan.active ? "badge-success" : "badge-muted"}`}>
                      {plan.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <div className="actions">
                      <button type="button" className="icon-btn" title="Edit plan" onClick={() => setEditing({ open: true, plan })}>
                        <Icon name="edit" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {editing.open ? <PlanDialog plan={editing.plan} onClose={() => setEditing({ open: false, plan: null })} /> : null}
    </>
  );
}

function PlanDialog({ plan, onClose }: { plan: PlanRow | null; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState(plan?.active ?? true);
  const [slug, setSlug] = useState(plan?.slug || "");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const features = String(form.get("features") || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const maxStaff = Number(form.get("maxStaff")) || 0;
    const maxBranches = Number(form.get("maxBranches")) || 0;
    const payload = {
      name: form.get("name"),
      slug,
      description: form.get("description") || null,
      monthlyPrice: Number(form.get("monthlyPrice")),
      yearlyPrice: form.get("yearlyPrice") === "" ? null : Number(form.get("yearlyPrice")),
      features,
      limits: {
        ...(maxStaff > 0 ? { maxStaff } : {}),
        ...(maxBranches > 0 ? { maxBranches } : {}),
      },
      active,
    };
    setPending(true);
    setError("");
    try {
      if (plan) {
        await apiRequest(`/api/platform/plans/${plan.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        toast.success("Plan updated.");
      } else {
        await apiRequest("/api/platform/plans", { method: "POST", body: JSON.stringify(payload) });
        toast.success("Plan created.");
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
      title={plan ? `Edit ${plan.name}` : "New plan"}
      wide
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>Cancel</button>
          <button type="submit" form="plan-form" className="btn btn-primary" disabled={pending}>
            {pending ? "Saving…" : plan ? "Save changes" : "Create plan"}
          </button>
        </>
      }
    >
      {error ? <div className="alert alert-error">{error}</div> : null}
      <form id="plan-form" onSubmit={submit}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="plan-name">Name</label>
            <input
              id="plan-name"
              name="name"
              className="input"
              defaultValue={plan?.name || ""}
              required
              maxLength={80}
              autoFocus
              onChange={(event) => {
                if (!plan) setSlug(slugify(event.target.value));
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="plan-slug">Slug</label>
            <input id="plan-slug" className="input" value={slug} onChange={(event) => setSlug(slugify(event.target.value))} required pattern="[a-z0-9-]+" />
          </div>
          <div className="field">
            <label htmlFor="plan-monthly">Monthly price (INR)</label>
            <input id="plan-monthly" name="monthlyPrice" type="number" min={0} step="0.01" className="input" defaultValue={plan?.monthlyPrice ?? 0} required />
          </div>
          <div className="field">
            <label htmlFor="plan-yearly">Yearly price (INR)</label>
            <input id="plan-yearly" name="yearlyPrice" type="number" min={0} step="0.01" className="input" defaultValue={plan?.yearlyPrice ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="plan-staff">Max staff (0 = unlimited)</label>
            <input id="plan-staff" name="maxStaff" type="number" min={0} className="input" defaultValue={plan?.limits.maxStaff ?? 0} />
          </div>
          <div className="field">
            <label htmlFor="plan-branches">Max branches (0 = unlimited)</label>
            <input id="plan-branches" name="maxBranches" type="number" min={0} className="input" defaultValue={plan?.limits.maxBranches ?? 0} />
          </div>
          <div className="field span-2">
            <label htmlFor="plan-description">Description</label>
            <input id="plan-description" name="description" className="input" defaultValue={plan?.description || ""} maxLength={500} />
          </div>
          <div className="field span-2">
            <label htmlFor="plan-features">Features (one per line)</label>
            <textarea id="plan-features" name="features" className="textarea" rows={5} defaultValue={(plan?.features || []).join("\n")} />
          </div>
          <div className="field span-2">
            <label className="switch">
              <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
              <span>Available for new subscriptions</span>
            </label>
          </div>
        </div>
      </form>
    </Modal>
  );
}
