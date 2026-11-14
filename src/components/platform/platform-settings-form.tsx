"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, errorMessage } from "@/lib/client";
import { useToast } from "@/components/ui/toast";
import { Icon } from "@/components/ui/icons";

export function PlatformSettingsForm({
  settings,
}: {
  settings: { platformName: string; supportEmail: string; trialDays: number; notice: string };
}) {
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
      await apiRequest("/api/platform/settings", {
        method: "PATCH",
        body: JSON.stringify({
          platformName: form.get("platformName"),
          supportEmail: form.get("supportEmail"),
          trialDays: Number(form.get("trialDays")),
          notice: form.get("notice") || "",
        }),
      });
      toast.success("Platform settings saved.");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="card" style={{ maxWidth: 640 }}>
      <div className="card-head">
        <div>
          <h2>Platform identity</h2>
          <p>Shown to platform staff and used as defaults for new trials.</p>
        </div>
      </div>
      <div className="card-body">
        {error ? <div className="alert alert-error">{error}</div> : null}
        <div className="form-grid">
          <div className="field span-2">
            <label htmlFor="platform-name">Platform name</label>
            <input id="platform-name" name="platformName" className="input" defaultValue={settings.platformName} required minLength={2} maxLength={80} />
          </div>
          <div className="field">
            <label htmlFor="platform-email">Support email</label>
            <input id="platform-email" name="supportEmail" type="email" className="input" defaultValue={settings.supportEmail} required />
          </div>
          <div className="field">
            <label htmlFor="platform-trial">Default trial days</label>
            <input id="platform-trial" name="trialDays" type="number" min={0} max={365} className="input" defaultValue={settings.trialDays} required />
          </div>
          <div className="field span-2">
            <label htmlFor="platform-notice">Operational notice</label>
            <textarea id="platform-notice" name="notice" className="textarea" defaultValue={settings.notice} maxLength={300} placeholder="Shown on the platform overview (optional)" />
          </div>
        </div>
      </div>
      <div className="card-body" style={{ borderTop: "1px solid var(--line)" }}>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          <Icon name="check" /> {pending ? "Saving…" : "Save settings"}
        </button>
      </div>
    </form>
  );
}
