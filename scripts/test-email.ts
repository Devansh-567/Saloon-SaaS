import "dotenv/config";
import nodemailer from "nodemailer";

async function main() {
  const to = process.argv[2];
  const { BREVO_API_KEY, SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_PASSWORD, MAIL_FROM } = process.env;
  if (!to) {
    console.log("Usage: npm run email:test -- you@example.com");
    process.exit(1);
  }
  if (!MAIL_FROM || (!BREVO_API_KEY && !SMTP_HOST)) {
    console.error("Set MAIL_FROM and either BREVO_API_KEY or SMTP_HOST first.");
    process.exit(1);
  }
  const subject = "Test email from your salon software";
  const text = "Good news: your email settings work.";
  if (BREVO_API_KEY) {
    const match = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(MAIL_FROM);
    const sender = match ? { name: match[1].trim() || undefined, email: match[2].trim() } : { email: MAIL_FROM.trim() };
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ sender, to: [{ email: to }], subject, textContent: text }),
    });
    const data = (await response.json().catch(() => null)) as { message?: string } | null;
    if (!response.ok) throw new Error(`Brevo said: ${data?.message || response.status}`);
    console.log(`Test email sent to ${to} through Brevo. Check the inbox and spam folder.`);
    return;
  }
  const port = Number(SMTP_PORT) || 587;
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: SMTP_SECURE === "true" || port === 465,
    ...(SMTP_USER ? { auth: { user: SMTP_USER, pass: SMTP_PASS || SMTP_PASSWORD } } : {}),
  });
  await transport.verify();
  await transport.sendMail({ from: MAIL_FROM, to, subject, text });
  console.log(`Test email sent to ${to}. Check the inbox and spam folder.`);
}

main().catch((error) => {
  console.error("Email test failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
