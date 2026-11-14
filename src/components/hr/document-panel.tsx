"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, errorMessage } from "@/lib/client";
import { DOCUMENT_KINDS, DOCUMENT_KIND_LABELS, type DocumentKindValue } from "@/lib/hr";
import { formatDay } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icons";

type DocumentRow = {
  id: string;
  membershipId: string;
  member: string;
  kind: string;
  title: string;
  fileName: string;
  fileId: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

type Member = { id: string; name: string };

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
}

export function DocumentPanel({
  rows,
  members,
  selfMembershipId,
  timezone,
  locale,
  canWrite,
  showMember,
}: {
  rows: DocumentRow[];
  members: Member[];
  selfMembershipId: string;
  timezone: string;
  locale: string;
  canWrite: boolean;
  showMember: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleting, setDeleting] = useState<DocumentRow | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  async function remove() {
    if (!deleting) return;
    setDeletePending(true);
    try {
      await apiRequest(`/api/hr/documents/${deleting.id}`, { method: "DELETE" });
      toast.success("Document removed.");
      setDeleting(null);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <>
      <section className="card">
        <div className="card-head">
          <div>
            <h2>Employee documents</h2>
            <p>ID proofs, photos, and signed contracts, kept private.</p>
          </div>
          {canWrite ? (
            <button type="button" className="btn btn-primary" onClick={() => setUploadOpen(true)} disabled={!members.length}>
              <Icon name="upload" /> Upload document
            </button>
          ) : null}
        </div>
        {rows.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  {showMember ? <th>Staff</th> : null}
                  <th>Document</th>
                  <th className="hide-mobile">Type</th>
                  <th className="hide-mobile">Added</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    {showMember ? <td>{row.member}</td> : null}
                    <td>
                      <a href={`/api/files/${row.fileId}`} target="_blank" rel="noreferrer" className="link cell-title">
                        {row.title}
                      </a>
                      <div className="cell-sub">{row.fileName} · {fileSize(row.size)}</div>
                    </td>
                    <td className="hide-mobile">{DOCUMENT_KIND_LABELS[row.kind as DocumentKindValue] || row.kind}</td>
                    <td className="hide-mobile">{formatDay(row.createdAt, timezone, locale)}</td>
                    <td>
                      <div className="actions">
                        <a className="icon-btn" href={`/api/files/${row.fileId}`} target="_blank" rel="noreferrer" title="Open document">
                          <Icon name="external" />
                        </a>
                        {canWrite ? (
                          <button type="button" className="icon-btn" title="Delete document" onClick={() => setDeleting(row)}>
                            <Icon name="trash" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="file" title="No documents yet" message="Upload Aadhaar, PAN, photos, or contracts for your team." />
        )}
      </section>
      {uploadOpen ? (
        <UploadDialog
          members={members}
          selfMembershipId={selfMembershipId}
          onClose={() => setUploadOpen(false)}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title="Delete document?"
        message={deleting ? `“${deleting.title}” will be removed permanently.` : ""}
        confirmLabel="Delete"
        danger
        pending={deletePending}
      />
    </>
  );
}

function UploadDialog({
  members,
  selfMembershipId,
  onClose,
}: {
  members: Member[];
  selfMembershipId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (members.length) form.set("membershipId", String(form.get("membershipId") || members[0]?.id));
    else form.set("membershipId", selfMembershipId);
    setPending(true);
    setError("");
    try {
      await apiRequest("/api/hr/documents", { method: "POST", body: form });
      toast.success("Document uploaded.");
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
      title="Upload employee document"
      description="PDF, PNG, JPG, or WEBP. Keep ID numbers out of the file name."
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>Cancel</button>
          <button type="submit" form="document-form" className="btn btn-primary" disabled={pending}>
            {pending ? "Uploading…" : "Upload"}
          </button>
        </>
      }
    >
      {error ? <div className="alert alert-error">{error}</div> : null}
      <form id="document-form" onSubmit={submit}>
        <div className="form-grid">
          {members.length ? (
            <div className="field span-2">
              <label htmlFor="document-member">Staff member</label>
              <select id="document-member" name="membershipId" className="select" defaultValue={members[0]?.id} required>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="document-kind">Type</label>
            <select id="document-kind" name="kind" className="select" defaultValue="AADHAAR">
              {DOCUMENT_KINDS.map((kind) => (
                <option key={kind} value={kind}>{DOCUMENT_KIND_LABELS[kind]}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="document-title">Name it</label>
            <input id="document-title" name="title" className="input" required placeholder="Aadhaar front" />
          </div>
          <div className="field span-2">
            <label htmlFor="document-file">File</label>
            <input id="document-file" name="file" type="file" className="input" accept="application/pdf,image/png,image/jpeg,image/webp" required />
          </div>
        </div>
      </form>
    </Modal>
  );
}
