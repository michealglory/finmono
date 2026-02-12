import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";

const schema = z.object({
  name: z.string().min(2),
  color: z.string().optional().nullable()
});

export async function GET(request: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const url = new URL(request.url);
  const includeArchived = url.searchParams.get("includeArchived") === "1";

  const tags = await prisma.tag.findMany({
    where: { userId: user.userId, ...(includeArchived ? {} : { archivedAt: null }) },
    orderBy: { name: "asc" }
  });

  return NextResponse.json({ tags });
}

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const tag = await prisma.tag.create({
    data: {
      userId: user.userId,
      name: parsed.data.name,
      color: parsed.data.color || null
    }
  });

  return NextResponse.json({ tag }, { status: 201 });
}
