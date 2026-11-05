"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiRequest, errorMessage } from "@/lib/client";
import { useToast } from "@/components/ui/toast";
import { PasswordInput } from "@/components/ui/password-input";
import { CompanyLogo } from "@/components/brand/company-logo";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("password") !== form.get("confirm")) {
      setError("The two passwords are not the same. Please type them again.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await apiRequest("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password: form.get("password") }),
      });
      toast.success("Password changed. Please sign in.");
      router.push("/login");
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
      <h1>Choose a new password</h1>
      <p className="auth-sub">At least 12 characters, with a letter and a number.</p>
      {!token ? (
        <div className="alert alert-error">
          This link is not complete. Please open the link from your email again, or <Link href="/forgot-password" className="link">ask for a new one</Link>.
        </div>
      ) : (
        <>
          {error ? <div className="alert alert-error">{error}</div> : null}
          <form onSubmit={submit}>
            <div className="field">
              <label htmlFor="password">New password</label>
              <PasswordInput id="password" name="password" className="input" autoComplete="new-password" required minLength={12} />
            </div>
            <div className="field" style={{ marginTop: 14 }}>
              <label htmlFor="confirm">Type it again</label>
              <PasswordInput id="confirm" name="confirm" className="input" autoComplete="new-password" required minLength={12} />
            </div>
            <button type="submit" className="btn btn-primary btn-block btn-lg" style={{ marginTop: 20 }} disabled={pending}>
              {pending ? "Saving…" : "Save new password"}
            </button>
          </form>
        </>
      )}
      <p className="auth-footer">
        <Link href="/login" className="link">Back to sign in</Link>
      </p>
    </div>
  );
}
