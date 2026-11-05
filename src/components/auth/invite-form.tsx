"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiRequest, errorMessage } from "@/lib/client";
import { useToast } from "@/components/ui/toast";

export function InviteForm({
  token,
  salonName,
  email,
  role,
  accountExists,
  signedIn,
}: {
  token: string;
  salonName: string;
  email: string;
  role: string;
  accountExists: boolean;
  signedIn: boolean;
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
      const body: Record<string, string> = {};
      if (!accountExists) {
        body.name = String(form.get("name") || "");
        body.password = String(form.get("password") || "");
      }
      await apiRequest(`/api/invitations/${token}/accept`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      toast.success(`You joined ${salonName}.`);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  if (accountExists && !signedIn) {
    return (
      <div className="auth-card">
        <div className="public-brand" style={{ marginBottom: 28, color: "var(--ink)" }}>
          <span className="brand-mark">S</span>
          Salon SaaS
        </div>
        <h1>You&apos;re invited.</h1>
        <p className="auth-sub">
          {salonName} invited <strong>{email}</strong> to join as {role.toLowerCase()}.
        </p>
        <div className="alert alert-info">An account already exists for this email. Sign in, then reopen this invitation link to join.</div>
        <Link href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`} className="btn btn-primary btn-block btn-lg">
          Sign in to accept
        </Link>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <div className="public-brand" style={{ marginBottom: 28, color: "var(--ink)" }}>
        <span className="brand-mark">S</span>
        Salon SaaS
      </div>
      <h1>Join {salonName}.</h1>
      <p className="auth-sub">
        You were invited as {role.toLowerCase()} using <strong>{email}</strong>.
      </p>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <form onSubmit={submit}>
        {!accountExists ? (
          <>
            <div className="field">
              <label htmlFor="name">Your name</label>
              <input id="name" name="name" className="input" required autoComplete="name" minLength={2} placeholder="Full name" />
            </div>
            <div className="field" style={{ marginTop: 14 }}>
              <label htmlFor="password">Create a password</label>
              <input id="password" name="password" type="password" className="input" required autoComplete="new-password" placeholder="At least 10 characters" />
            </div>
          </>
        ) : (
          <div className="alert alert-success">Signed in as {email}. Accept the invitation to add this salon to your account.</div>
        )}
        <button type="submit" className="btn btn-primary btn-block btn-lg" style={{ marginTop: 20 }} disabled={pending}>
          {pending ? "Joining…" : `Accept and join ${salonName}`}
        </button>
      </form>
      <p className="auth-footer">
        Wrong account? <Link href="/login" className="link">Sign in with another account</Link>
      </p>
    </div>
  );
}
