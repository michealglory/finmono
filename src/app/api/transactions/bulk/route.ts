import { Direction } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/auth/require-user";
import { applyBulkTransactionAction } from "@/server/services/transaction-bulk";

const filtersSchema = z.object({
  accountId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  direction: z.nativeEnum(Direction).optional().nullable(),
  q: z.string().optional().nullable(),
  from: z.string().optional().nullable(),
  to: z.string().optional().nullable(),
  includeDeleted: z.boolean().optional()
});

const bulkSchema = z
  .object({
    action: z.enum(["assign_category", "clear_category", "soft_delete", "restore"]),
    selection: z.discriminatedUnion("mode", [
      z.object({
        mode: z.literal("explicit_ids"),
        ids: z.array(z.string()).min(1)
      }),
      z.object({
        mode: z.literal("all_filtered"),
        filters: filtersSchema.optional()
      })
    ]),
    data: z
      .object({
        categoryId: z.string().optional().nullable()
      })
      .optional()
  })
  .superRefine((value, ctx) => {
    if (value.action === "assign_category" && !value.data?.categoryId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["data", "categoryId"],
        message: "categoryId is required for assign_category"
      });
    }
  });

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const parsed = bulkSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await applyBulkTransactionAction({
      userId: user.userId,
      action: parsed.data.action,
      selection: parsed.data.selection,
      data: parsed.data.data
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Bulk action failed" }, { status: 400 });
  }
}
