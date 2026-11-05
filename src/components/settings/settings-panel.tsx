"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, errorMessage } from "@/lib/client";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { Icon } from "@/components/ui/icons";

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Moscow",
  "Africa/Cairo",
  "Africa/Lagos",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Pacific/Auckland",
];

const CURRENCIES = ["USD", "EUR", "GBP", "AUD", "CAD", "AED", "SAR", "INR", "PKR", "BDT", "SGD", "JPY", "ZAR", "NGN", "BRL"];

const LOCALES = ["en-US", "en-GB", "en-AU", "en-CA", "en-IN", "ar-AE", "de-DE", "fr-FR", "es-ES", "pt-BR", "ja-JP"];

type SalonSettings = {
  accentColor: string;
  receiptHeader: string;
  receiptFooter: string;
  showLogo: boolean;
  loyaltyPointsPerCurrency: number;
  invoiceDueDays: number;
  allowWalkIns: boolean;
  notifyOnInvoice: boolean;
};

type SalonProfile = {
  name: string;
  email: string;
  phone: string;
  address: string | null;
  timezone: string;
  currency: string;
  locale: string;
  logoFileId: string | null;
  settings: SalonSettings;
};

export function SalonProfilePanel({ salon }: { salon: SalonProfile }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const logo = salon.logoFileId ? `/api/files/${salon.logoFileId}` : null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      await apiRequest("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          phone: form.get("phone"),
          address: form.get("address") || null,
          timezone: form.get("timezone"),
          currency: form.get("currency"),
          locale: form.get("locale"),
          settings: {
            accentColor: form.get("accentColor"),
            receiptHeader: form.get("receiptHeader") || "",
            receiptFooter: form.get("receiptFooter") || "",
            loyaltyPointsPerCurrency: Number(form.get("loyaltyPointsPerCurrency")) || 0,
            invoiceDueDays: Number(form.get("invoiceDueDays")) || 0,
            showLogo: form.get("showLogo") === "on",
            allowWalkIns: form.get("allowWalkIns") === "on",
            notifyOnInvoice: form.get("notifyOnInvoice") === "on",
          },
        }),
      });
      toast.success("Settings saved.");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function uploadLogo(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const upload = new FormData();
      upload.append("file", file);
      await apiRequest("/api/settings/logo", { method: "POST", body: upload });
      toast.success("Logo updated.");
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  return (
    <form className="rich-grid" onSubmit={submit}>
      <div className="stack">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Business profile</h2>
              <p>Shown on bills and receipts.</p>
            </div>
          </div>
          <div className="card-body">
            {error ? <div className="alert alert-error">{error}</div> : null}
            <div className="form-grid">
              <div className="field span-2">
                <label htmlFor="salon-name">Salon name</label>
                <input id="salon-name" name="name" className="input" defaultValue={salon.name} required minLength={2} maxLength={120} />
              </div>
              <div className="field">
                <label htmlFor="salon-email">Email</label>
                <input id="salon-email" name="email" type="email" className="input" defaultValue={salon.email} required />
              </div>
              <div className="field">
                <label htmlFor="salon-phone">Phone</label>
                <input id="salon-phone" name="phone" className="input" defaultValue={salon.phone} required />
              </div>
              <div className="field span-2">
                <label htmlFor="salon-address">Address</label>
                <input id="salon-address" name="address" className="input" defaultValue={salon.address || ""} maxLength={500} />
              </div>
              <div className="field">
                <label htmlFor="salon-timezone">Timezone</label>
                <select id="salon-timezone" name="timezone" className="select" defaultValue={salon.timezone}>
                  {[salon.timezone, ...TIMEZONES.filter((zone) => zone !== salon.timezone)].map((zone) => (
                    <option key={zone} value={zone}>{zone.replaceAll("_", " ")}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="salon-currency">Currency</label>
                <select id="salon-currency" name="currency" className="select" defaultValue={salon.currency}>
                  {[salon.currency, ...CURRENCIES.filter((code) => code !== salon.currency)].map((code) => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="salon-locale">Locale</label>
                <select id="salon-locale" name="locale" className="select" defaultValue={salon.locale}>
                  {[salon.locale, ...LOCALES.filter((code) => code !== salon.locale)].map((code) => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="salon-accent">Accent colour</label>
                <input id="salon-accent" name="accentColor" type="color" className="input" defaultValue={salon.settings.accentColor} style={{ padding: 4, height: 40 }} />
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2>Operations</h2>
              <p>Bills, reward points and front desk options.</p>
            </div>
          </div>
          <div className="card-body">
            <div className="form-grid">
              <div className="field">
                <label htmlFor="salon-due">Days allowed to pay</label>
                <input id="salon-due" name="invoiceDueDays" type="number" min={0} max={365} className="input" defaultValue={salon.settings.invoiceDueDays} />
              </div>
              <div className="field">
                <label htmlFor="salon-loyalty">Reward points for every 1 spent</label>
                <input id="salon-loyalty" name="loyaltyPointsPerCurrency" type="number" min={0} max={100} step="0.1" className="input" defaultValue={salon.settings.loyaltyPointsPerCurrency} />
              </div>
              <div className="field span-2">
                <label htmlFor="salon-receipt-header">Receipt header</label>
                <input id="salon-receipt-header" name="receiptHeader" className="input" defaultValue={salon.settings.receiptHeader} maxLength={200} />
              </div>
              <div className="field span-2">
                <label htmlFor="salon-receipt-footer">Receipt footer</label>
                <input id="salon-receipt-footer" name="receiptFooter" className="input" defaultValue={salon.settings.receiptFooter} maxLength={300} />
              </div>
              <div className="field">
                <label className="switch">
                  <input type="checkbox" name="showLogo" defaultChecked={salon.settings.showLogo} />
                  <span>Show logo on documents</span>
                </label>
              </div>
              <div className="field">
                <label className="switch">
                  <input type="checkbox" name="allowWalkIns" defaultChecked={salon.settings.allowWalkIns} />
                  <span>Use the waiting list</span>
                </label>
              </div>
              <div className="field">
                <label className="switch">
                  <input type="checkbox" name="notifyOnInvoice" defaultChecked={salon.settings.notifyOnInvoice} />
                  <span>Send customers their bill automatically</span>
                </label>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="stack">
        <section className="card">
          <div className="card-head">
            <h2>Logo</h2>
          </div>
          <div className="card-body">
            <div className="logo-preview">{logo ? <img src={logo} alt="Salon logo" /> : <Icon name="building" />}</div>
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="logo-file" className="field-label">Replace logo</label>
              <input id="logo-file" type="file" className="input file-input" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={uploadLogo} disabled={uploading} />
              <small>{uploading ? "Uploading…" : "PNG, JPEG, WebP, or SVG."}</small>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-body">
            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={pending}>
              <Icon name="check" />
              {pending ? "Saving…" : "Save settings"}
            </button>
          </div>
        </section>
      </div>
    </form>
  );
}

type Branch = { id: string; name: string; phone: string | null; address: string | null; isPrimary: boolean; active: boolean };

export function BranchesPanel({ branches, canWrite }: { branches: Branch[]; canWrite: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<{ open: boolean; branch: Branch | null }>({ open: false, branch: null });
  const [toggling, setToggling] = useState<Branch | null>(null);
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (!toggling) return;
    setPending(true);
    try {
      await apiRequest(`/api/settings/branches/${toggling.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !toggling.active }),
      });
      toast.success(toggling.active ? `${toggling.name} closed.` : `${toggling.name} reopened.`);
      setToggling(null);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>Branches</h2>
          <p>Locations customers can be booked into.</p>
        </div>
        {canWrite ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing({ open: true, branch: null })}>
            <Icon name="plus" /> Add branch
          </button>
        ) : null}
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Branch</th>
              <th className="hide-mobile">Phone</th>
              <th>Status</th>
              {canWrite ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {branches.map((branch) => (
              <tr key={branch.id}>
                <td>
                  <div className="cell-title">
                    {branch.name} {branch.isPrimary ? <span className="badge badge-accent">Primary</span> : null}
                  </div>
                  {branch.address ? <div className="cell-sub">{branch.address}</div> : null}
                </td>
                <td className="hide-mobile">{branch.phone || "—"}</td>
                <td>
                  <span className={`badge ${branch.active ? "badge-success" : "badge-muted"}`}>
                    {branch.active ? "Open" : "Closed"}
                  </span>
                </td>
                {canWrite ? (
                  <td>
                    <div className="actions">
                      <button type="button" className="icon-btn" title="Edit branch" onClick={() => setEditing({ open: true, branch })}>
                        <Icon name="edit" />
                      </button>
                      {branch.isPrimary ? null : (
                        <button type="button" className="icon-btn" title={branch.active ? "Close branch" : "Reopen branch"} onClick={() => setToggling(branch)}>
                          <Icon name={branch.active ? "pause" : "play"} />
                        </button>
                      )}
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing.open ? <BranchDialog branch={editing.branch} onClose={() => setEditing({ open: false, branch: null })} /> : null}
      <ConfirmDialog
        open={Boolean(toggling)}
        onClose={() => setToggling(null)}
        onConfirm={toggle}
        title={toggling?.active ? "Close branch?" : "Reopen branch?"}
        message={toggling?.active ? "The branch stays on historical records but is hidden from new bookings." : "The branch becomes selectable for bookings again."}
        confirmLabel={toggling?.active ? "Close branch" : "Reopen branch"}
        pending={pending}
      />
    </section>
  );
}

function BranchDialog({ branch, onClose }: { branch: Branch | null; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      name: form.get("name"),
      phone: form.get("phone") || null,
      address: form.get("address") || null,
    };
    setPending(true);
    setError("");
    try {
      if (branch) {
        await apiRequest(`/api/settings/branches/${branch.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        toast.success("Branch updated.");
      } else {
        await apiRequest("/api/settings/branches", { method: "POST", body: JSON.stringify(payload) });
        toast.success("Branch added.");
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
      title={branch ? "Edit branch" : "Add branch"}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>Cancel</button>
          <button type="submit" form="branch-form" className="btn btn-primary" disabled={pending}>
            {pending ? "Saving…" : branch ? "Save changes" : "Add branch"}
          </button>
        </>
      }
    >
      {error ? <div className="alert alert-error">{error}</div> : null}
      <form id="branch-form" onSubmit={submit}>
        <div className="form-grid">
          <div className="field span-2">
            <label htmlFor="branch-name">Name</label>
            <input id="branch-name" name="name" className="input" defaultValue={branch?.name || ""} required maxLength={120} autoFocus />
          </div>
          <div className="field">
            <label htmlFor="branch-phone">Phone</label>
            <input id="branch-phone" name="phone" className="input" defaultValue={branch?.phone || ""} maxLength={30} />
          </div>
          <div className="field">
            <label htmlFor="branch-address">Address</label>
            <input id="branch-address" name="address" className="input" defaultValue={branch?.address || ""} maxLength={500} />
          </div>
        </div>
      </form>
    </Modal>
  );
}
