/**
 * COMPANY BRANDING — this is the place for the company that sells this software
 * (not the salon). Change the values here and replace the logo files in
 * `public/brand/`. See `public/brand/README.txt`.
 *
 * Salon owners still upload their own salon logo in Settings; that never
 * replaces this one.
 */
export const BRAND = {
  /** Company name, shown next to the logo and in "Powered by". */
  name: "Your Company Name",
  /** Short line shown on the login page. */
  tagline: "Simple software to run your salon",
  /** Logo for light backgrounds (login form, landing page, bills). */
  logoSrc: "/brand/logo.svg",
  /** Logo for dark backgrounds (side menu, login side panel). */
  logoOnDarkSrc: "/brand/logo-light.svg",
  /** Optional: where the logo should link to. Leave "" for no link. */
  website: "",
  /** Show a small "Powered by" line on printed/PDF bills. Set false to hide. */
  showOnBills: true,
} as const;
