import "server-only";
import { env } from "./env";

type MailInput = {
  to: string;
  subject: string;
  text: string;
  attachment?: { filename: string; content: Buffer };
};

export function emailIsConfigured() {
  return Boolean(env.MAIL_FROM && (env.BREVO_API_KEY || env.SMTP_HOST));
}

function parseSender(from: string) {
  const match = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(from);
  return match ? { name: match[1].trim() || undefined, email: match[2].trim() } : { email: from.trim() };
}

async function sendWithBrevo(input: MailInput) {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": env.BREVO_API_KEY as string, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: parseSender(env.MAIL_FROM as string),
      to: [{ email: input.to }],
      subject: input.subject,
      textContent: input.text,
      ...(input.attachment
        ? { attachment: [{ name: input.attachment.filename, content: input.attachment.content.toString("base64") }] }
        : {}),
    }),
    signal: AbortSignal.timeout(15000),
  });
  const data = (await response.json().catch(() => null)) as { messageId?: string; message?: string } | null;
  if (!response.ok) throw new Error(`Brevo: ${data?.message || response.status}`);
  return data?.messageId ?? null;
}

async function sendWithSmtp(input: MailInput) {
  const nodemailer = (await import("nodemailer")).default;
  const port = env.SMTP_PORT || 587;
  const password = env.SMTP_PASS || env.SMTP_PASSWORD;
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure: env.SMTP_SECURE || port === 465,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: password } } : {}),
  });
  const result = await transport.sendMail({
    from: env.MAIL_FROM,
    to: input.to,
    subject: input.subject,
    text: input.text,
    ...(input.attachment ? { attachments: [{ filename: input.attachment.filename, content: input.attachment.content }] } : {}),
  });
  if (!result.accepted?.length) throw new Error("The mail server did not accept the message");
  return result.messageId || null;
}

export async function sendEmail(input: MailInput) {
  if (!emailIsConfigured()) throw new Error("Email is not set up");
  return env.BREVO_API_KEY ? sendWithBrevo(input) : sendWithSmtp(input);
}
