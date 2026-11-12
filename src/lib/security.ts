import { z } from "zod";

const hasLetter = /[A-Za-z]/;
const hasDigit = /\d/;

export const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(128)
  .refine((v) => hasLetter.test(v) && hasDigit.test(v), "Password must include a letter and a number");

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const phoneSchema = z.string().trim().min(5).max(30);
