import { BRAND } from "@/lib/brand";

/** The company's (software maker's) logo. Not the salon's logo. */
export function CompanyLogo({
  onDark = false,
  height = 28,
  link = true,
}: {
  onDark?: boolean;
  height?: number;
  link?: boolean;
}) {
  const image = (
    <img
      src={onDark ? BRAND.logoOnDarkSrc : BRAND.logoSrc}
      alt={BRAND.name}
      height={height}
      style={{ height, width: "auto", maxWidth: "100%", display: "block", objectFit: "contain" }}
    />
  );
  // On dark backgrounds the logo sits on a small white plate so any logo colour stays readable.
  const content = onDark ? <span className="logo-plate">{image}</span> : image;
  return BRAND.website && link ? (
    <a href={BRAND.website} target="_blank" rel="noopener noreferrer" aria-label={BRAND.name}>
      {content}
    </a>
  ) : (
    content
  );
}

/** Small "Powered by <logo>" line for footers. */
export function PoweredBy({ onDark = false, height = 20 }: { onDark?: boolean; height?: number }) {
  return (
    <div className={`powered-by ${onDark ? "on-dark" : ""}`}>
      <span>Powered by</span>
      <CompanyLogo onDark={onDark} height={height} />
    </div>
  );
}
