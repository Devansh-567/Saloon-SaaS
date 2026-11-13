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
import { describe, expect, it } from "vitest";
import { forgotPasswordInput, resetPasswordInput } from "../src/lib/validation";

describe("forgot / reset password validation", () => {
  it("normalises the email", () => {
    expect(forgotPasswordInput.parse({ email: "  Owner@Salon.COM " }).email).toBe("owner@salon.com");
  });

  it("rejects a bad email", () => {
    expect(() => forgotPasswordInput.parse({ email: "not-an-email" })).toThrow();
  });

  it("needs a real token and a strong password", () => {
    const token = "a".repeat(43);
    expect(resetPasswordInput.parse({ token, password: "correct-horse-battery-9" }).token).toBe(token);
    expect(() => resetPasswordInput.parse({ token: "short", password: "correct-horse-battery-9" })).toThrow();
    expect(() => resetPasswordInput.parse({ token, password: "tooshort1" })).toThrow();
    expect(() => resetPasswordInput.parse({ token, password: "nodigitsatallhere" })).toThrow();
  });
});
