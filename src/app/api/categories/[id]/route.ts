import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";
import { deleteCategoryWithStrategy } from "@/server/services/category-management";

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  parentId: z.string().nullable().optional(),
  level: z.number().min(1).max(2).optional()
});

const deleteSchema = z.object({
  strategy: z.enum(["reassign", "uncategorized"]),
  targetCategoryId: z.string().optional(),
  childStrategy: z.enum(["reassign", "archive", "block"]).optional(),
  childTargetCategoryId: z.string().optional()
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const params = await context.params;
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const current = await prisma.category.findFirst({ where: { id: params.id, userId: user.userId } });
  if (!current) return NextResponse.json({ error: "Category not found" }, { status: 404 });
  if (current.isSystem) return NextResponse.json({ error: "System category cannot be edited" }, { status: 400 });

  const category = await prisma.category.update({
    where: { id: params.id },
    data: {
      name: parsed.data.name,
      parentId: parsed.data.parentId,
      level: parsed.data.level
    }
  });

  return NextResponse.json({ category });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const params = await context.params;
  const body = await request.json();
  const parsed = deleteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await deleteCategoryWithStrategy({
      userId: user.userId,
      categoryId: params.id,
      strategy: parsed.data.strategy,
      targetCategoryId: parsed.data.targetCategoryId,
      childStrategy: parsed.data.childStrategy,
      childTargetCategoryId: parsed.data.childTargetCategoryId
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Delete failed" },
      { status: 400 }
    );
  }
}
