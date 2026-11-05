import type { Metadata } from "next";
import { getPlatformSettings } from "@/services/platform";
import { env } from "@/lib/env";
import { PlatformSettingsForm } from "@/components/platform/platform-settings-form";
import { Icon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Platform settings" };
export const dynamic = "force-dynamic";

export default async function PlatformSettingsPage() {
  const settings = await getPlatformSettings();
  const smtpConfigured = Boolean(env.SMTP_HOST);
  const twilioConfigured = Boolean(env.TWILIO_ACCOUNT_SID);

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Platform settings</h1>
          <p className="page-subtitle">Platform-wide defaults and integration status.</p>
        </div>
      </div>

      <PlatformSettingsForm
        settings={{
          platformName: settings.platformName,
          supportEmail: settings.supportEmail,
          trialDays: settings.trialDays,
          notice: settings.notice,
        }}
      />

      <section className="card" style={{ maxWidth: 640 }}>
        <div className="card-head">
          <div>
            <h2>Integrations</h2>
            <p>Providers are configured through environment variables and restart-required.</p>
          </div>
        </div>
        <div className="card-body">
          <ul className="simple-list">
            <li>
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Icon name="mail" />
                Email (SMTP)
              </span>
              <span className={`badge ${smtpConfigured ? "badge-success" : "badge-muted"}`}>
                {smtpConfigured ? "Configured" : "Not configured"}
              </span>
            </li>
            <li>
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Icon name="phone" />
                SMS / WhatsApp (Twilio)
              </span>
              <span className={`badge ${twilioConfigured ? "badge-success" : "badge-muted"}`}>
                {twilioConfigured ? "Configured" : "Not configured"}
              </span>
            </li>
            <li>
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Icon name="globe" />
                App URL
              </span>
              <span className="cell-sub">{env.APP_URL}</span>
            </li>
          </ul>
          <p className="hint" style={{ marginTop: 12 }}>
            When a provider is missing, outbound notifications are logged with status “skipped” instead of being silently dropped.
          </p>
        </div>
      </section>
    </div>
  );
}
