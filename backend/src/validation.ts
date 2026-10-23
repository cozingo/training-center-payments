import { z } from "zod";

const isRealDate = (s: string) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

export const idParam = z.coerce.number().int().positive();

export const studentCreate = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().regex(/^\+?[0-9\s\-()]{7,20}$/, "Invalid phone number"),
  group: z.string().trim().min(1),
  monthlyFee: z.number().int().nonnegative(),
});

export const studentUpdate = studentCreate
  .partial()
  .refine((v) => Object.keys(v).length > 0, "At least one field is required");

export const paymentCreate = z.object({
  amount: z.number().int().positive(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
    .refine(isRealDate, "Invalid date"),
});

export const monthQuery = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Expected month=YYYY-MM"),
});
