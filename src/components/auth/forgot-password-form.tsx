"use client";

import Link from "next/link";
import { useState } from "react";
import { apiRequest, errorMessage } from "@/lib/client";
import { CompanyLogo } from "@/components/brand/company-logo";

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ emailConfigured: boolean } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      setResult(await apiRequest<{ emailConfigured: boolean }>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: form.get("email") }),
      }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-card">
      <div style={{ marginBottom: 28 }}>
        <CompanyLogo height={34} />
      </div>
      <h1>Forgot your password?</h1>
      <p className="auth-sub">Enter your email and we will send you a link to choose a new password.</p>
      {error ? <div className="alert alert-error">{error}</div> : null}
      {result ? (
        result.emailConfigured ? (
          <div className="alert alert-success">
            If this email has an account, a reset link is on its way. It works for 60 minutes. Please also check your spam folder.
          </div>
        ) : (
          <div className="alert alert-warning">
            Password reset by email is not switched on yet. Please ask your salon owner to reset your password, or contact support.
          </div>
        )
      ) : (
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="email">Email address</label>
            <input id="email" name="email" type="email" className="input" autoComplete="email" required placeholder="you@salon.com" />
          </div>
          <button type="submit" className="btn btn-primary btn-block btn-lg" style={{ marginTop: 20 }} disabled={pending}>
            {pending ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
      <p className="auth-footer">
        <Link href="/login" className="link">Back to sign in</Link>
      </p>
    </div>
  );
}
