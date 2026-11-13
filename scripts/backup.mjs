# Copyright (c) 2026 Devansh Singh
# All Rights Reserved.
#
# This software and its source code are proprietary
# and confidential property of Guru AI Technologies.
#
# Unauthorized copying, modification, distribution,
# or use of this software, in whole or in part,
# is strictly prohibited without prior written
# permission from Guru AI Technologies.
import { execFileSync } from "node:child_process";
import { mkdirSync, cpSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dir = resolve("backups", stamp);
mkdirSync(dir, { recursive: true });
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL is required");
execFileSync("pg_dump", ["--no-owner", "--format=custom", "--file", resolve(dir, "database.dump"), dbUrl], {
  stdio: "inherit",
});
const storage = resolve(process.env.STORAGE_ROOT || "./storage");
cpSync(storage, resolve(dir, "storage"), { recursive: true });
writeFileSync(
  resolve(dir, "manifest.json"),
  JSON.stringify({ createdAt: new Date().toISOString(), database: "database.dump", storage: "storage" }, null, 2),
);
console.log(`Backup written to ${dir}`);
