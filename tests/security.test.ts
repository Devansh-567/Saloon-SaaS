import { describe, expect, it } from "vitest";
import { emailSchema, passwordSchema, phoneSchema } from "@/lib/security";

describe("passwordSchema", () => {
  it("accepts a password with a letter, a number, and 12 characters", () => {
    expect(passwordSchema.parse("SalonDemo!2026")).toBe("SalonDemo!2026");
  });

  it("rejects short passwords", () => {
    expect(passwordSchema.safeParse("Short1").success).toBe(false);
  });

  it("rejects passwords without both a letter and a number", () => {
    expect(passwordSchema.safeParse("abcdefghijkl").success).toBe(false);
    expect(passwordSchema.safeParse("123456789012").success).toBe(false);
  });

  it("rejects passwords over 128 characters", () => {
    expect(passwordSchema.safeParse(`${"a1".repeat(64)}x`).success).toBe(false);
  });
});

describe("emailSchema", () => {
  it("trims and lowercases addresses", () => {
    expect(emailSchema.parse("  Owner@Demo.LOCAL  ")).toBe("owner@demo.local");
  });

  it("rejects malformed addresses", () => {
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
  });
});

describe("phoneSchema", () => {
  it("trims surrounding whitespace", () => {
    expect(phoneSchema.parse("  +1 555 010 1000  ")).toBe("+1 555 010 1000");
  });

  it("requires at least five characters", () => {
    expect(phoneSchema.safeParse("1234").success).toBe(false);
  });
});
