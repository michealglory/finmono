import { z } from "zod";

export const extractedTransactionSchema = z.object({
  date: z.string(),
  description: z.string(),
  merchantName: z.string().optional().nullable(),
  amount: z.number(),
  currency: z.string(),
  direction: z.enum(["INCOME", "EXPENSE"]),
  categoryHint: z.string().optional().nullable()
});

export const statementExtractionSchema = z.object({
  accountHint: z.string().optional().nullable(),
  transactions: z.array(extractedTransactionSchema)
});

export const receiptExtractionSchema = z.object({
  merchantName: z.string().nullable(),
  date: z.string(),
  currency: z.string(),
  total: z.number(),
  lineItems: z.array(
    z.object({
      description: z.string(),
      quantity: z.number().optional().nullable(),
      unitPrice: z.number().optional().nullable(),
      amount: z.number(),
      categoryHint: z.string().optional().nullable()
    })
  )
});
