import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";

if (existsSync(".env")) {
  console.error(".env already exists; refusing to overwrite.");
  process.exit(1);
}
const secret = () => randomBytes(32).toString("base64");
const dbPassword = randomBytes(18).toString("base64url");
const content = `NODE_ENV=development
APP_URL=http://localhost:3000
DATABASE_URL=postgresql://salon:${dbPassword}@localhost:5434/salon_saas?schema=public
DB_PASSWORD=${dbPassword}
APP_SECRET=${secret()}
MFA_ENCRYPTION_KEY=${secret()}
STORAGE_ROOT=./storage
MAX_UPLOAD_MB=5
SESSION_TTL_HOURS=12
SESSION_IDLE_MINUTES=120
TRIAL_DAYS=14
LOG_LEVEL=info
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
MAIL_FROM=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_SMS_FROM=
TWILIO_WHATSAPP_FROM=
`;
writeFileSync(".env", content, { mode: 0o600 });
console.log("Created .env with generated secrets. Set SUPER_ADMIN_* and OWNER_* before seeding.");
