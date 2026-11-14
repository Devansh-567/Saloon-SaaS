"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, errorMessage } from "@/lib/client";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { Icon } from "@/components/ui/icons";

type Template = {
  id: string;
  key: string;
  channel: string;
  subject: string | null;
  body: string;
  enabled: boolean;
};

const PLACEHOLDERS = "{{salonName}}, {{customerName}}, {{invoiceNumber}}, {{invoiceTotal}}, {{appointmentTime}}";

export function TemplatesPanel({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<{ open: boolean; template: Template | null }>({ open: false, template: null });
  const [removing, setRemoving] = useState<Template | null>(null);
  const [pending, setPending] = useState(false);

  async function remove() {
    if (!removing) return;
    setPending(true);
    try {
      await apiRequest(`/api/platform/templates/${removing.id}`, { method: "DELETE" });
      toast.success("Template deleted.");
      setRemoving(null);
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
        <div className="card-head">
          <div>
            <h2>Global templates</h2>
            <p>Salons inherit these unless they override them locally.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setEditing({ open: true, template: null })}>
            <Icon name="plus" /> New template
          </button>
        </div>
        {templates.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Channel</th>
                  <th className="hide-mobile">Subject</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template.id}>
                    <td><span className="cell-title">{template.key}</span></td>
                    <td><span className="badge badge-plain">{template.channel.toLowerCase()}</span></td>
                    <td className="hide-mobile">{template.subject || "—"}</td>
                    <td>
                      <span className={`badge ${template.enabled ? "badge-success" : "badge-muted"}`}>
                        {template.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </td>
                    <td>
                      <div className="actions">
                        <button type="button" className="icon-btn" title="Edit template" onClick={() => setEditing({ open: true, template })}>
                          <Icon name="edit" />
                        </button>
                        <button type="button" className="icon-btn" title="Delete template" onClick={() => setRemoving(template)}>
                          <Icon name="trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card-body">
            <p className="hint" style={{ margin: 0 }}>
              No global templates defined. Notification jobs fall back to the built-in defaults until a template is added here.
            </p>
          </div>
        )}
      </section>

      {editing.open ? <TemplateDialog template={editing.template} onClose={() => setEditing({ open: false, template: null })} /> : null}
      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={remove}
        title="Delete template?"
        message={removing ? `Salons using “${removing.key}” (${removing.channel.toLowerCase()}) fall back to the built-in default.` : ""}
        confirmLabel="Delete template"
        danger
        pending={pending}
      />
    </>
  );
}

function TemplateDialog({ template, onClose }: { template: Template | null; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [enabled, setEnabled] = useState(template?.enabled ?? true);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      await apiRequest("/api/platform/templates", {
        method: "POST",
        body: JSON.stringify({
          key: form.get("key"),
          channel: form.get("channel"),
          subject: form.get("subject") || null,
          body: form.get("body"),
          enabled,
        }),
      });
      toast.success("Template saved.");
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
      title={template ? `Edit ${template.key}` : "New template"}
      wide
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>Cancel</button>
          <button type="submit" form="template-form" className="btn btn-primary" disabled={pending}>
            {pending ? "Saving…" : "Save template"}
          </button>
        </>
      }
    >
      {error ? <div className="alert alert-error">{error}</div> : null}
      <form id="template-form" onSubmit={submit}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="template-key">Key</label>
            <input id="template-key" name="key" className="input" defaultValue={template?.key || ""} required pattern="[a-z0-9_]+" placeholder="invoice_issued" readOnly={Boolean(template)} />
          </div>
          <div className="field">
            <label htmlFor="template-channel">Channel</label>
            <select id="template-channel" name="channel" className="select" defaultValue={template?.channel || "EMAIL"} disabled={Boolean(template)}>
              {["EMAIL", "SMS", "WHATSAPP"].map((channel) => (
                <option key={channel} value={channel}>{channel.toLowerCase()}</option>
              ))}
            </select>
            {template ? <input type="hidden" name="channel" value={template.channel} /> : null}
          </div>
          <div className="field span-2">
            <label htmlFor="template-subject">Subject (email only)</label>
            <input id="template-subject" name="subject" className="input" defaultValue={template?.subject || ""} maxLength={200} />
          </div>
          <div className="field span-2">
            <label htmlFor="template-body">Body</label>
            <textarea id="template-body" name="body" className="textarea" rows={7} defaultValue={template?.body || ""} required />
            <small>Available placeholders: {PLACEHOLDERS}</small>
          </div>
          <div className="field span-2">
            <label className="switch">
              <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
              <span>Enable this template</span>
            </label>
          </div>
        </div>
      </form>
    </Modal>
  );
}
