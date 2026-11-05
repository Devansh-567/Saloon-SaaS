"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, errorMessage } from "@/lib/client";
import { formatDay } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icons";

type SalonRow = {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string;
  status: string;
  createdAt: string;
  owner: { name: string; email: string };
  memberCount: number;
  branchCount: number;
  customerCount: number;
  subscription: { id: string; status: string; plan: string } | null;
};

type Plan = { id: string; name: string; active: boolean };

export function SalonsPanel({ salons, plans }: { salons: SalonRow[]; plans: Plan[] }) {
  const router = useRouter();
  const toast = useToast();
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [subscription, setSubscription] = useState<SalonRow | null>(null);
  const [statusChange, setStatusChange] = useState<SalonRow | null>(null);
  const [pending, setPending] = useState(false);

  async function updateStatus() {
    if (!statusChange) return;
    setPending(true);
    try {
      const next = statusChange.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
      await apiRequest(`/api/platform/salons/${statusChange.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      toast.success(next === "SUSPENDED" ? `${statusChange.name} suspended.` : `${statusChange.name} reactivated.`);
      setStatusChange(null);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="card-head">
        <div>
          <h2>All salons</h2>
          <p>Suspending a salon immediately signs out every active session.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setOnboardOpen(true)}>
          <Icon name="plus" /> Onboard salon
        </button>
      </div>
      <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Salon</th>
                <th className="hide-mobile">Owner</th>
                <th className="num hide-mobile">Team</th>
                <th className="num hide-mobile">Customers</th>
                <th>Plan</th>
                <th>Status</th>
                <th className="hide-mobile">Joined</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {salons.map((salon) => (
                <tr key={salon.id}>
                  <td>
                    <div className="cell-title">{salon.name}</div>
                    <div className="cell-sub">/{salon.slug} · {salon.email}</div>
                  </td>
                  <td className="hide-mobile">
                    <div>{salon.owner.name}</div>
                    <div className="cell-sub">{salon.owner.email}</div>
                  </td>
                  <td className="num hide-mobile">{salon.memberCount}</td>
                  <td className="num hide-mobile">{salon.customerCount}</td>
                  <td>
                    {salon.subscription ? (
                      <>
                        <div>{salon.subscription.plan}</div>
                        <StatusBadge status={salon.subscription.status} />
                      </>
                    ) : (
                      <span className="badge badge-plain">No plan</span>
                    )}
                  </td>
                  <td><StatusBadge status={salon.status} /></td>
                  <td className="hide-mobile">{formatDay(salon.createdAt, "UTC", "en-US")}</td>
                  <td>
                    <div className="actions">
                      <button type="button" className="icon-btn" title="Manage subscription" onClick={() => setSubscription(salon)}>
                        <Icon name="card" />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        title={salon.status === "SUSPENDED" ? "Reactivate salon" : "Suspend salon"}
                        onClick={() => setStatusChange(salon)}
                      >
                        <Icon name={salon.status === "SUSPENDED" ? "play" : "ban"} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      </div>

      {onboardOpen ? <OnboardDialog plans={plans} onClose={() => setOnboardOpen(false)} /> : null}
      {subscription ? <SubscriptionDialog salon={subscription} plans={plans} onClose={() => setSubscription(null)} /> : null}

      <ConfirmDialog
        open={Boolean(statusChange)}
        onClose={() => setStatusChange(null)}
        onConfirm={updateStatus}
        title={statusChange?.status === "SUSPENDED" ? "Reactivate salon?" : "Suspend salon?"}
        message={
          statusChange?.status === "SUSPENDED"
            ? `${statusChange.name} will regain access immediately.`
            : `${statusChange?.name} members will be signed out and blocked until reactivated.`
        }
        confirmLabel={statusChange?.status === "SUSPENDED" ? "Reactivate" : "Suspend"}
        danger={statusChange?.status !== "SUSPENDED"}
        pending={pending}
      />
    </>
  );
}

function OnboardDialog({ plans, onClose }: { plans: Plan[]; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      await apiRequest("/api/platform/salons", {
        method: "POST",
        body: JSON.stringify({
          salonName: form.get("salonName"),
          ownerName: form.get("ownerName"),
          ownerEmail: form.get("ownerEmail"),
          ownerPassword: form.get("ownerPassword"),
          phone: form.get("phone"),
          timezone: form.get("timezone") || "UTC",
          currency: form.get("currency") || "INR",
          planId: form.get("planId") || null,
        }),
      });
      toast.success("Salon onboarded. The owner will be asked to change the password at first sign-in.");
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
      title="Onboard salon"
      description="Creates the owner account, primary branch, and optional trial subscription."
      wide
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>Cancel</button>
          <button type="submit" form="onboard-form" className="btn btn-primary" disabled={pending}>
            {pending ? "Creating…" : "Create salon"}
          </button>
        </>
      }
    >
      {error ? <div className="alert alert-error">{error}</div> : null}
      <form id="onboard-form" onSubmit={submit}>
        <div className="form-grid">
          <div className="field span-2">
            <label htmlFor="onboard-salon">Salon name</label>
            <input id="onboard-salon" name="salonName" className="input" required minLength={2} autoFocus />
          </div>
          <div className="field">
            <label htmlFor="onboard-owner">Owner name</label>
            <input id="onboard-owner" name="ownerName" className="input" required minLength={2} />
          </div>
          <div className="field">
            <label htmlFor="onboard-email">Owner email</label>
            <input id="onboard-email" name="ownerEmail" type="email" className="input" required />
          </div>
          <div className="field">
            <label htmlFor="onboard-password">Temporary password</label>
            <input id="onboard-password" name="ownerPassword" type="text" className="input" required minLength={10} placeholder="Minimum 10 characters" />
            <small>The owner must change it at first sign-in.</small>
          </div>
          <div className="field">
            <label htmlFor="onboard-phone">Phone</label>
            <input id="onboard-phone" name="phone" className="input" required />
          </div>
          <div className="field">
            <label htmlFor="onboard-timezone">Timezone</label>
            <input id="onboard-timezone" name="timezone" className="input" defaultValue="UTC" />
          </div>
          <div className="field">
            <label htmlFor="onboard-currency">Currency</label>
            <input id="onboard-currency" name="currency" className="input" defaultValue="INR" maxLength={3} />
          </div>
          <div className="field span-2">
            <label htmlFor="onboard-plan">Plan</label>
            <select id="onboard-plan" name="planId" className="select">
              <option value="">No subscription</option>
              {plans.filter((plan) => plan.active).map((plan) => (
                <option key={plan.id} value={plan.id}>{plan.name}</option>
              ))}
            </select>
            <small>Trials start immediately when a plan is selected.</small>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function SubscriptionDialog({ salon, plans, onClose }: { salon: SalonRow; plans: Plan[]; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      await apiRequest(`/api/platform/salons/${salon.id}/subscription`, {
        method: "PATCH",
        body: JSON.stringify({
          planId: form.get("planId"),
          status: form.get("status"),
          trialEndsAt: form.get("trialEndsAt") || null,
          currentPeriodEnd: form.get("currentPeriodEnd") || null,
        }),
      });
      toast.success("Subscription updated.");
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
      title={`Subscription · ${salon.name}`}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>Cancel</button>
          <button type="submit" form="subscription-form" className="btn btn-primary" disabled={pending}>
            {pending ? "Saving…" : "Save subscription"}
          </button>
        </>
      }
    >
      {error ? <div className="alert alert-error">{error}</div> : null}
      <form id="subscription-form" onSubmit={submit}>
        <div className="form-grid">
          <div className="field span-2">
            <label htmlFor="subscription-plan">Plan</label>
            <select id="subscription-plan" name="planId" className="select" required defaultValue="">
              <option value="" disabled>Choose plan</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>{plan.name}{plan.active ? "" : " (inactive)"}</option>
              ))}
            </select>
          </div>
          <div className="field span-2">
            <label htmlFor="subscription-status">Status</label>
            <select id="subscription-status" name="status" className="select" defaultValue="ACTIVE">
              {["TRIALING", "ACTIVE", "PAST_DUE", "CANCELED"].map((status) => (
                <option key={status} value={status}>{status.replaceAll("_", " ").toLowerCase()}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="subscription-trial">Trial ends</label>
            <input id="subscription-trial" name="trialEndsAt" type="date" className="input" />
          </div>
          <div className="field">
            <label htmlFor="subscription-period">Current period ends</label>
            <input id="subscription-period" name="currentPeriodEnd" type="date" className="input" />
          </div>
        </div>
      </form>
    </Modal>
  );
}
