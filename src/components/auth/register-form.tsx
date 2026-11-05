"use client";

import { CompanyLogo } from "@/components/brand/company-logo";
import { PasswordInput } from "@/components/ui/password-input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiRequest, errorMessage } from "@/lib/client";
import { useToast } from "@/components/ui/toast";

const timezones = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Istanbul",
  "Africa/Cairo",
  "Africa/Lagos",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

export function RegisterForm() {
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
      const result = await apiRequest<{ redirectTo: string }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          salonName: form.get("salonName"),
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
          phone: form.get("phone"),
          timezone: form.get("timezone"),
          currency: form.get("currency"),
        }),
      });
      toast.success("Your salon workspace is ready.");
      router.push(result.redirectTo || "/dashboard");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-card">
      <div style={{ marginBottom: 24 }}>
        <CompanyLogo height={34} />
      </div>
      <h1>Create your workspace.</h1>
      <p className="auth-sub">Start with the salon, then add your services, stock, and team.</p>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field span-2">
            <label htmlFor="salonName">Salon name</label>
            <input id="salonName" name="salonName" className="input" required placeholder="e.g. North Row Studio" minLength={2} />
          </div>
          <div className="field">
            <label htmlFor="name">Your name</label>
            <input id="name" name="name" className="input" required autoComplete="name" placeholder="Full name" minLength={2} />
          </div>
          <div className="field">
            <label htmlFor="phone">Phone</label>
            <input id="phone" name="phone" type="tel" className="input" required autoComplete="tel" placeholder="+1 555 010 2000" />
          </div>
          <div className="field span-2">
            <label htmlFor="email">Email address</label>
            <input id="email" name="email" type="email" className="input" required autoComplete="email" placeholder="you@salon.com" />
          </div>
          <div className="field span-2">
            <label htmlFor="password">Password</label>
            <PasswordInput id="password" name="password" className="input" required autoComplete="new-password" placeholder="At least 10 characters" />
            <small>Use uppercase, lowercase, a number, and a symbol.</small>
          </div>
          <div className="field">
            <label htmlFor="timezone">Timezone</label>
            <select id="timezone" name="timezone" className="select" defaultValue="UTC">
              {timezones.map((zone) => (
                <option value={zone} key={zone}>
                  {zone.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="currency">Currency</label>
            <select id="currency" name="currency" className="select" defaultValue="INR">
              {["USD", "EUR", "GBP", "CAD", "AUD", "INR", "AED", "SAR", "NGN", "BRL", "JPY"].map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button type="submit" className="btn btn-primary btn-block btn-lg" style={{ marginTop: 20 }} disabled={pending}>
          {pending ? "Creating workspace…" : "Create salon workspace"}
        </button>
      </form>
      <p className="auth-footer">
        Already have an account? <Link href="/login" className="link">Sign in</Link>
      </p>
    </div>
  );
}
