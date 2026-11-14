"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiRequest, errorMessage } from "@/lib/client";
import { useToast } from "@/components/ui/toast";
import type { LoyaltyRules } from "@/lib/loyalty";

type BranchRules = { id: string; name: string; custom: LoyaltyRules | null };

function RulesFields({ prefix, rules }: { prefix: string; rules: LoyaltyRules }) {
  return (
    <div className="form-grid">
      <label className="span-2" style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="checkbox" name={`${prefix}-enabled`} defaultChecked={rules.enabled} />
        <span>Give and accept reward points</span>
      </label>
      <div className="field">
        <label htmlFor={`${prefix}-earn`}>Points earned for every 1 spent</label>
        <input id={`${prefix}-earn`} name={`${prefix}-earn`} type="number" min={0} max={100} step="0.01" className="input" defaultValue={rules.earnPerCurrency} />
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-value`}>Money value of 1 point</label>
        <input id={`${prefix}-value`} name={`${prefix}-value`} type="number" min={0} max={1000} step="0.01" className="input" defaultValue={rules.valuePerPoint} />
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-min`}>Least points that can be used</label>
        <input id={`${prefix}-min`} name={`${prefix}-min`} type="number" min={0} step="1" className="input" defaultValue={rules.minRedeemPoints} />
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-max`}>Most of a bill points can pay (%)</label>
        <input id={`${prefix}-max`} name={`${prefix}-max`} type="number" min={0} max={100} step="1" className="input" defaultValue={rules.maxRedeemPercent} />
      </div>
      <div className="field span-2">
        <label htmlFor={`${prefix}-perks`}>Perks note shown while billing</label>
        <input id={`${prefix}-perks`} name={`${prefix}-perks`} className="input" maxLength={300} defaultValue={rules.perks} placeholder="Example: 500 points = free hair spa" />
      </div>
    </div>
  );
}

function readRules(form: FormData, prefix: string): LoyaltyRules {
  return {
    enabled: form.get(`${prefix}-enabled`) === "on",
    earnPerCurrency: Number(form.get(`${prefix}-earn`)) || 0,
    valuePerPoint: Number(form.get(`${prefix}-value`)) || 0,
    minRedeemPoints: Math.floor(Number(form.get(`${prefix}-min`)) || 0),
    maxRedeemPercent: Number(form.get(`${prefix}-max`)) || 0,
    perks: String(form.get(`${prefix}-perks`) || ""),
  };
}

export function LoyaltyPanel({
  salonRules,
  branches,
  canWrite,
}: {
  salonRules: LoyaltyRules;
  branches: BranchRules[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [customIds, setCustomIds] = useState<string[]>(branches.filter((branch) => branch.custom).map((branch) => branch.id));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      await apiRequest("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({ settings: { loyalty: readRules(form, "salon") } }),
      });
      for (const branch of branches) {
        const custom = customIds.includes(branch.id);
        if (!custom && !branch.custom) continue;
        await apiRequest(`/api/settings/branches/${branch.id}`, {
          method: "PATCH",
          body: JSON.stringify({ loyalty: custom ? readRules(form, branch.id) : null }),
        });
      }
      toast.success("Reward points settings saved.");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>Reward points</h2>
          <p>Customers earn points on paid bills and can use them to pay part of a bill. Set one common rule for every branch, or give a branch its own rule.</p>
        </div>
      </div>
      <form onSubmit={submit}>
        <div className="card-body" style={{ display: "grid", gap: 20 }}>
          {error ? <div className="alert alert-error">{error}</div> : null}
          <fieldset disabled={!canWrite} style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 20 }}>
            <div>
              <h3 style={{ margin: "0 0 10px" }}>Common rule (all branches)</h3>
              <RulesFields prefix="salon" rules={salonRules} />
            </div>
            {branches.map((branch) => {
              const custom = customIds.includes(branch.id);
              return (
                <div key={branch.id} style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }}>
                  <h3 style={{ margin: "0 0 10px" }}>{branch.name}</h3>
                  <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
                    <input
                      type="checkbox"
                      checked={custom}
                      onChange={(event) =>
                        setCustomIds((current) => (event.target.checked ? [...current, branch.id] : current.filter((id) => id !== branch.id)))
                      }
                    />
                    <span>This branch has its own rule</span>
                  </label>
                  {custom ? <RulesFields prefix={branch.id} rules={branch.custom || salonRules} /> : <p className="muted" style={{ margin: 0 }}>Uses the common rule above.</p>}
                </div>
              );
            })}
          </fieldset>
        </div>
        {canWrite ? (
          <div className="card-body" style={{ paddingTop: 0 }}>
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? "Saving…" : "Save reward points"}
            </button>
          </div>
        ) : null}
      </form>
    </section>
  );
}
