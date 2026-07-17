import { z } from "zod";

export const initiateStkPushSchema = z.object({
  leaseId: z.string().uuid(),
  phoneNumber: z.string().min(9, "A valid phone number is required"),
  amountKes: z.number().positive(),
});
