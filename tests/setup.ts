const env = process.env as Record<string, string | undefined>;
env.NODE_ENV = "test";
process.env.APP_URL = process.env.APP_URL || "http://localhost:3000";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://salon:salon@localhost:5434/salon_test?schema=public";
process.env.APP_SECRET = process.env.APP_SECRET || "test-secret-value-with-at-least-32-characters";
process.env.MFA_ENCRYPTION_KEY = process.env.MFA_ENCRYPTION_KEY || Buffer.alloc(32, 7).toString("base64");
process.env.STORAGE_ROOT = process.env.STORAGE_ROOT || "./.test-storage";
