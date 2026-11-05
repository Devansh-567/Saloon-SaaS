import { CompanyLogo } from "@/components/brand/company-logo";
import Link from "next/link";
import { getVerifiedViewer } from "@/lib/auth";
import { Icon, type IconName } from "@/components/ui/icons";

const features: Array<{ icon: IconName; title: string; body: string }> = [
  {
    icon: "calendar",
    title: "Appointments that hold together",
    body: "Staff schedules, service durations, and overlap protection keep the day realistic from the first booking to the last check-in.",
  },
  {
    icon: "ticket",
    title: "A waiting list anyone can read",
    body: "See who is waiting, who is next and who is being served, all in one place.",
  },
  {
    icon: "card",
    title: "Bills without guesswork",
    body: "Services, discounts, tax, staff commission, payments and PDF receipts are worked out and saved in one place.",
  },
  {
    icon: "box",
    title: "Stock tied to the work",
    body: "Keep track of products, stock bought and stock used, with a warning when something runs low.",
  },
  {
    icon: "team",
    title: "Roles with real boundaries",
    body: "Owners configure access per person. Staff see their own work; billing and reports stay with the people who need them.",
  },
  {
    icon: "chart",
    title: "Numbers you can act on",
    body: "Sales, collections, expenses, staff performance, retention, and low stock are drawn from the same operational records.",
  },
];

const steps = [
  ["Set the foundation", "Add branches, services, tax rates, and your team. Configure how the salon actually operates."],
  ["Run the day", "Book appointments, keep the waiting list, check customers in, and keep the front desk moving."],
  ["Close the loop", "Make bills, take payments, add expenses and see how your salon is doing."],
] as const;

export default async function LandingPage() {
  const viewer = await getVerifiedViewer();
  const isSuperAdmin = viewer?.user.platformRole === "SUPER_ADMIN";
  const destination = isSuperAdmin ? "/platform" : "/dashboard";

  return (
    <div>
      <section className="hero">
        <div className="container">
          <nav className="public-nav">
            <Link href="/" className="public-brand">
              <CompanyLogo onDark height={32} link={false} />
            </Link>
            <div className="public-nav-links">
              <a href="#capabilities" className="btn btn-ghost" style={{ color: "rgba(255,255,255,.72)" }}>
                Capabilities
              </a>
              {viewer ? (
                <Link href={destination} className="btn btn-secondary">
                  Open workspace
                </Link>
              ) : (
                <>
                  <Link href="/login" className="btn btn-ghost" style={{ color: "rgba(255,255,255,.82)" }}>
                    Sign in
                  </Link>
                  <Link href="/register" className="btn btn-secondary">
                    Start your salon
                  </Link>
                </>
              )}
            </div>
          </nav>
          <div className="hero-inner">
            <div>
              <div className="eyebrow" style={{ color: "#d8b79e", fontSize: 10.5, letterSpacing: ".14em", textTransform: "uppercase", fontWeight: 700, marginBottom: 15 }}>
                Salon operations, in one place
              </div>
              <h1>
                A calmer front desk.
                <br />
                <em>A clearer business.</em>
              </h1>
              <p className="hero-lead">
                Appointments, waiting customers, bills, stock, expenses and staff permissions — built to work together,
                not as a pile of disconnected tools.
              </p>
              <div className="hero-actions">
                <Link href={viewer ? destination : "/register"} className="btn btn-primary btn-lg">
                  {viewer ? "Open your workspace" : "Create your salon workspace"}
                  <Icon name="arrow" />
                </Link>
                {!viewer ? (
                  <Link href="/login" className="btn btn-secondary btn-lg">
                    Sign in
                  </Link>
                ) : null}
              </div>
              <div style={{ display: "flex", gap: 22, flexWrap: "wrap", marginTop: 28, color: "rgba(255,255,255,.55)", fontSize: 11.5 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                  <Icon name="shield" style={{ width: 15, height: 15 }} /> Role-based access
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                  <Icon name="lock" style={{ width: 15, height: 15 }} /> MFA available
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                  <Icon name="file" style={{ width: 15, height: 15 }} /> Local file storage
                </span>
              </div>
            </div>
            <div className="hero-panel">
              <div className="hero-panel-label">The working day</div>
              {[
                ["calendar", "Confirm tomorrow", "See gaps, overlaps, and unconfirmed bookings before they become a problem."],
                ["ticket", "Keep customers moving", "See who is waiting, who is next and who is being served."],
                ["card", "Finish the bill", "Totals, tax and payments always add up."],
                ["box", "Know what is low", "Back-bar and retail stock move with the work that consumes them."],
              ].map(([icon, title, body]) => (
                <div className="mock-row" key={title}>
                  <div className="mock-left">
                    <span className="mock-avatar">
                      <Icon name={icon as IconName} style={{ width: 16, height: 16 }} />
                    </span>
                    <div>
                      <strong>{title}</strong>
                      <span style={{ maxWidth: 250, whiteSpace: "normal", display: "block", lineHeight: 1.4 }}>{body}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="capabilities">
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">Capabilities</div>
            <h2>Everything the floor needs. Nothing it does not.</h2>
            <p>Purpose-built modules share the same customer, staff, and financial records, so the story stays consistent.</p>
          </div>
          <div className="feature-grid">
            {features.map((feature) => (
              <article className="feature" key={feature.title}>
                <div className="feature-icon">
                  <Icon name={feature.icon} style={{ width: 19, height: 19 }} />
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="roles-strip">
        <div className="container roles-inner">
          <span>Clear lanes for every role</span>
          <div className="roles-list">
            {["Owner", "Administrator", "Manager", "Receptionist", "Staff"].map((role) => (
              <span className="role-chip" key={role}>
                {role}
              </span>
            ))}
          </div>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,.5)", fontFamily: "var(--font-sans)" }}>
            Defaults are sensible. Per-person overrides are available.
          </span>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">The rhythm</div>
            <h2>From setup to a closed day.</h2>
          </div>
          <div className="grid-3">
            {steps.map(([title, body], index) => (
              <div className="card" key={title}>
                <div className="card-body">
                  <div className="feature-icon" style={{ fontFamily: "var(--font-display)", fontSize: 18 }}>
                    {index + 1}
                  </div>
                  <h3 style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 650, marginBottom: 6 }}>{title}</h3>
                  <p style={{ color: "var(--muted)", fontSize: 12.5, margin: 0 }}>{body}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 34, padding: 28, borderRadius: 18, background: "var(--ink)", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 22, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ fontSize: "clamp(1.5rem, 2.6vw, 2rem)", marginBottom: 5, color: "#fff" }}>Bring the whole salon into one workspace.</h2>
              <p style={{ margin: 0, color: "rgba(255,255,255,.58)", fontSize: 12.5 }}>Set up your first branch, services, and team in one pass.</p>
            </div>
            <Link href={viewer ? destination : "/register"} className="btn btn-primary btn-lg">
              {viewer ? "Open workspace" : "Get started"}
              <Icon name="arrow" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="container public-footer">
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <CompanyLogo height={26} />
        </div>
        <span>Operational software for people who run salons.</span>
        <span>© {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}
