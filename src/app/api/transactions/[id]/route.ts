import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";

const updateSchema = z.object({
  categoryId: z.string().nullable().optional(),
  notes: z.string().nullable().optional()
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const params = await context.params;
  const body = await request.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const transaction = await prisma.transaction.updateMany({
    where: { id: params.id, userId: user.userId },
    data: {
      categoryId: parsed.data.categoryId ?? undefined,
      notes: parsed.data.notes ?? undefined
    }
  });

  return NextResponse.json({ updated: transaction.count });
}
