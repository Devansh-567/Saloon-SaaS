import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { emailSchema, passwordSchema } from "../src/lib/security";

const prisma = new PrismaClient();

function usage() {
  console.log(`
Create or promote a platform super administrator.

Usage:
  npm run admin:create -- <email> <password> [name]

Or provide credentials through the environment:
  SUPER_ADMIN_EMAIL=admin@example.com SUPER_ADMIN_PASSWORD='...' SUPER_ADMIN_NAME='Platform Admin' npm run admin:create

Passing the password as a command argument can expose it in shell history.
Prefer the environment variables above, especially on shared machines.
`);
}

async function main() {
  const [, , emailArg, passwordArg, nameArg] = process.argv;
  const rawEmail = emailArg || process.env.SUPER_ADMIN_EMAIL;
  const rawPassword = passwordArg || process.env.SUPER_ADMIN_PASSWORD;
  const name = (nameArg || process.env.SUPER_ADMIN_NAME || "Platform Admin").trim();

  if (!rawEmail || !rawPassword) {
    usage();
    process.exit(1);
  }

  const email = emailSchema.parse(rawEmail);
  const password = passwordSchema.parse(rawPassword);
  if (!name || name.length > 120) {
    throw new Error("Name must be between 1 and 120 characters");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      passwordHash,
      platformRole: "SUPER_ADMIN",
      mustChangePassword: false,
    },
    update: {
      name,
      passwordHash,
      platformRole: "SUPER_ADMIN",
      mustChangePassword: false,
      failedAttempts: 0,
      lockedUntil: null,
    },
  });

  console.log(`Super administrator ready: ${user.email}`);
  console.log("Sign in at /login — you will be taken to /platform.");
  console.log("Enable MFA from Account security before using this account against production data.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
