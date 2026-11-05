"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiRequest, errorMessage } from "@/lib/client";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { Icon } from "@/components/ui/icons";

type SetupResult = { secret: string; uri: string; qrCode: string };

export function SecurityPanel({ mfaEnabled, required }: { mfaEnabled: boolean; required: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [passwordPending, setPasswordPending] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [setup, setSetup] = useState<SetupResult | null>(null);
  const [setupPending, setSetupPending] = useState(false);
  const [enablePending, setEnablePending] = useState(false);
  const [disablePending, setDisablePending] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("newPassword") !== form.get("confirmPassword")) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }
    setPasswordPending(true);
    setPasswordError("");
    try {
      await apiRequest("/api/account/password", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword: form.get("currentPassword"), newPassword: form.get("newPassword") }),
      });
      toast.success("Password updated. Other sessions have been signed out.");
      event.currentTarget.reset();
      if (required) {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (error) {
      setPasswordError(errorMessage(error));
    } finally {
      setPasswordPending(false);
    }
  }

  async function beginSetup() {
    setSetupPending(true);
    try {
      const result = await apiRequest<SetupResult>("/api/account/mfa/setup", { method: "POST" });
      setSetup(result);
      setModalOpen(true);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSetupPending(false);
    }
  }

  async function enableMfa(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setEnablePending(true);
    try {
      const result = await apiRequest<{ recoveryCodes: string[] }>("/api/account/mfa/enable", {
        method: "POST",
        body: JSON.stringify({ code: form.get("code") }),
      });
      setRecoveryCodes(result.recoveryCodes);
      setModalOpen(false);
      setSetup(null);
      toast.success("Two-factor authentication enabled.");
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setEnablePending(false);
    }
  }

  async function disableMfa(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setDisablePending(true);
    try {
      await apiRequest("/api/account/mfa/disable", {
        method: "POST",
        body: JSON.stringify({ password: form.get("password"), code: form.get("code") }),
      });
      toast.success("Two-factor authentication disabled.");
      event.currentTarget.reset();
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setDisablePending(false);
    }
  }

  return (
    <div className="stack">
      {required ? (
        <div className="notice">
          <Icon name="lock" style={{ width: 17, height: 17 }} />
          <div>
            <strong>Password change required.</strong> An administrator created your account with a temporary password. Choose a
            private password below to continue to the workspace.
          </div>
        </div>
      ) : null}

      <section className="card">
        <div className="card-head">
          <div>
            <h2>Password</h2>
            <p>Changing your password signs out all other active sessions.</p>
          </div>
          <Icon name="key" style={{ width: 18, height: 18, color: "var(--accent)" }} />
        </div>
        <div className="card-body">
          {passwordError ? <div className="alert alert-error">{passwordError}</div> : null}
          <form onSubmit={changePassword}>
            <div className="form-grid">
              <div className="field span-2">
                <label htmlFor="currentPassword">Current password</label>
                <input id="currentPassword" name="currentPassword" type="password" className="input" required autoComplete="current-password" />
              </div>
              <div className="field">
                <label htmlFor="newPassword">New password</label>
                <input id="newPassword" name="newPassword" type="password" className="input" required autoComplete="new-password" minLength={10} />
                <small>Uppercase, lowercase, number, and symbol.</small>
              </div>
              <div className="field">
                <label htmlFor="confirmPassword">Confirm new password</label>
                <input id="confirmPassword" name="confirmPassword" type="password" className="input" required autoComplete="new-password" />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={passwordPending}>
                {passwordPending ? "Updating…" : "Update password"}
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>Two-factor authentication</h2>
            <p>Protect sign-in with an authenticator app and single-use recovery codes.</p>
          </div>
          <span className={`badge ${mfaEnabled ? "badge-success" : "badge-plain"}`}>{mfaEnabled ? "Enabled" : "Not enabled"}</span>
        </div>
        <div className="card-body">
          {mfaEnabled ? (
            <div className="grid-2" style={{ alignItems: "start" }}>
              <div>
                <p style={{ margin: "0 0 12px", color: "var(--ink-soft)", fontSize: 13 }}>
                  MFA is active on this account. To disable it, confirm your password and a current authenticator or recovery code.
                </p>
                <form onSubmit={disableMfa} className="form-grid one">
                  <div className="field">
                    <label htmlFor="disable-password">Password</label>
                    <input id="disable-password" name="password" type="password" className="input" required autoComplete="current-password" />
                  </div>
                  <div className="field">
                    <label htmlFor="disable-code">Authenticator or recovery code</label>
                    <input id="disable-code" name="code" className="input mono" required autoComplete="one-time-code" />
                  </div>
                  <button type="submit" className="btn btn-soft-danger" disabled={disablePending}>
                    {disablePending ? "Disabling…" : "Turn off 2-step login"}
                  </button>
                </form>
              </div>
              <div className="callout">
                <Icon name="shield" style={{ width: 18, height: 18, color: "var(--success)" }} />
                <p style={{ margin: "8px 0 0" }}>
                  Keep your recovery codes somewhere safe. Each code can be used once if you lose access to your authenticator.
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 20, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
              <div style={{ maxWidth: 540 }}>
                <p style={{ margin: "0 0 8px", color: "var(--ink-soft)", fontSize: 13 }}>
                  Add a second step to sign-in. You will enter a six-digit code after your password.
                </p>
                <span className="hint">Supported by standard authenticator apps using time-based codes.</span>
              </div>
              <button type="button" className="btn btn-primary" onClick={beginSetup} disabled={setupPending}>
                <Icon name="shield" />
                {setupPending ? "Preparing…" : "Turn on 2-step login"}
              </button>
            </div>
          )}
        </div>
      </section>

      <Modal
        open={modalOpen && Boolean(setup)}
        onClose={() => setModalOpen(false)}
        title="Set up two-factor authentication"
        description="Scan the QR code, then verify a code from your authenticator."
        footer={
          <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
            Close
          </button>
        }
      >
        {setup ? (
          <form onSubmit={enableMfa} className="grid-2" style={{ alignItems: "start" }}>
            <div style={{ textAlign: "center" }}>
              <img src={setup.qrCode} alt="Authenticator QR code" width={220} height={220} style={{ border: "1px solid var(--line)", borderRadius: 12 }} />
              <div className="mono" style={{ marginTop: 10 }}>{setup.secret}</div>
              <span className="hint">Enter this secret manually if scanning is not possible.</span>
            </div>
            <div>
              <div className="field">
                <label htmlFor="setup-code">Six-digit code</label>
                <input id="setup-code" name="code" className="input mono" required inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="one-time-code" />
              </div>
              <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 14 }} disabled={enablePending}>
                {enablePending ? "Verifying…" : "Confirm and turn on"}
              </button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(recoveryCodes)}
        onClose={() => setRecoveryCodes(null)}
        title="Save your recovery codes"
        description="These codes will not be shown again."
        footer={
          <button type="button" className="btn btn-primary" onClick={() => setRecoveryCodes(null)}>
            I have saved them
          </button>
        }
      >
        <div className="mono" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {recoveryCodes?.map((code) => (
            <span key={code} style={{ background: "var(--surface-soft)", padding: "7px 9px", borderRadius: 6 }}>
              {code}
            </span>
          ))}
        </div>
      </Modal>
    </div>
  );
}
