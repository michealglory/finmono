import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";
import { deleteAccountWithStrategy } from "@/server/services/account-management";

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  currency: z.string().min(3).max(3).optional(),
  institution: z.string().nullable().optional()
});

const deleteSchema = z.object({
  strategy: z.enum(["reassign", "block"]),
  targetAccountId: z.string().optional()
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const params = await context.params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await prisma.account.updateMany({
    where: { id: params.id, userId: user.userId },
    data: {
      name: parsed.data.name,
      currency: parsed.data.currency?.toUpperCase(),
      institution: parsed.data.institution
    }
  });

  return NextResponse.json({ updated: updated.count });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const params = await context.params;
  const parsed = deleteSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const result = await deleteAccountWithStrategy({
      userId: user.userId,
      accountId: params.id,
      strategy: parsed.data.strategy,
      targetAccountId: parsed.data.targetAccountId
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Delete failed" }, { status: 400 });
  }
}
