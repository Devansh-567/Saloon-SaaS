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
import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import { hashPassword, needsRehash, verifyDummyPassword, verifyPassword } from "../src/lib/password";

describe("password hashing", () => {
  it("hashes and verifies with scrypt", async () => {
    const hash = await hashPassword("correct-horse-battery-9");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct-horse-battery-9", hash)).toBe(true);
    expect(await verifyPassword("wrong-password-123", hash)).toBe(false);
    expect(needsRehash(hash)).toBe(false);
  });

  it("gives a different hash for the same password each time", async () => {
    const [a, b] = await Promise.all([hashPassword("same-password-12"), hashPassword("same-password-12")]);
    expect(a).not.toBe(b);
  });

  it("still accepts old bcrypt hashes and asks for an upgrade", async () => {
    const legacy = await bcrypt.hash("legacy-password-12", 4);
    expect(await verifyPassword("legacy-password-12", legacy)).toBe(true);
    expect(await verifyPassword("other-password-12", legacy)).toBe(false);
    expect(needsRehash(legacy)).toBe(true);
  });

  it("rejects malformed stored hashes", async () => {
    expect(await verifyPassword("anything", "scrypt$bad")).toBe(false);
  });

  it("dummy verification never succeeds", async () => {
    expect(await verifyDummyPassword("anything-at-all-1")).toBe(false);
  });
});
