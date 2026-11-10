/**
 * COMPANY BRANDING: this is for the company that makes and sells this software
 * (not the salon). Salon owners upload their own salon logo in Settings; that
 * never replaces this one.
 *
 * LOGO: put your logo file in  public/brand/  and name it exactly
 *   logo.png   (best)   or   logo.webp / logo.jpg / logo.svg
 * See public/brand/README.txt.
 */
export const BRAND = {
  /** Company name, shown in "Powered by" and on PDF bills. */
  name: "Your Company Name",
  /** Short line shown under the logo on the sign-in page. */
  tagline: "Simple software to run your salon",
  /** Served from public/brand/logo.(png|webp|jpg|svg). Do not change. */
  logoSrc: "/brand-logo",
  /** Same file; it is shown on a white plate when the background is dark. */
  logoOnDarkSrc: "/brand-logo",
  /** Optional: where the logo should link to. Leave "" for no link. */
  website: "",
  /** Show a small "Powered by" line on printed/PDF bills. Set false to hide. */
  showOnBills: true,
} as const;
