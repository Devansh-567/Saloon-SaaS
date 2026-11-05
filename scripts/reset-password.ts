import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { emailSchema, passwordSchema } from "../src/lib/security";

const prisma = new PrismaClient();

async function main() {
  const [, , emailArg, passwordArg] = process.argv;
  const rawEmail = emailArg || process.env.RESET_EMAIL;
  const rawPassword = passwordArg || process.env.RESET_PASSWORD;
  if (!rawEmail || !rawPassword) {
    console.log("Usage: npm run admin:reset-password -- <email> <new-password>");
    console.log("Or set RESET_EMAIL and RESET_PASSWORD in the environment.");
    process.exit(1);
  }
  const email = emailSchema.parse(rawEmail);
  const password = passwordSchema.parse(rawPassword);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user found with email ${email}`);
    process.exit(1);
  }
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(password, 12), mustChangePassword: false, failedAttempts: 0, lockedUntil: null },
    }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
  ]);
  console.log(`Password updated for ${email}. They have been signed out everywhere.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
