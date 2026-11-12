import "dotenv/config";
import nodemailer from "nodemailer";

async function main() {
  const to = process.argv[2];
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;
  if (!to) {
    console.log("Usage: npm run email:test -- you@example.com");
    process.exit(1);
  }
  if (!SMTP_HOST || !MAIL_FROM) {
    console.error("SMTP_HOST and MAIL_FROM are not set. Fill them in your environment settings first.");
    process.exit(1);
  }
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: SMTP_SECURE === "true",
    ...(SMTP_USER ? { auth: { user: SMTP_USER, pass: SMTP_PASS } } : {}),
  });
  await transport.verify();
  const result = await transport.sendMail({
    from: MAIL_FROM,
    to,
    subject: "Test email from your salon software",
    text: "Good news: your email settings work. Password reset emails will now be delivered.",
  });
  console.log(result.accepted.length ? `Test email sent to ${to}. Check the inbox (and spam folder).` : "The mail server did not accept the email.");
}

main().catch((error) => {
  console.error("Email test failed:", error instanceof Error ? error.message : error);
  console.error("Check: host, port (587 with SMTP_SECURE=false, or 465 with SMTP_SECURE=true), user, and app password.");
  process.exit(1);
});
