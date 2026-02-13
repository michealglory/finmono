import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";

const schema = z.object({
  name: z.string().min(2),
  currency: z.string().min(3).max(3),
  institution: z.string().optional().nullable()
});

export async function GET(request: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const url = new URL(request.url);
  const includeArchived = url.searchParams.get("includeArchived") === "1";

  const accounts = await prisma.account.findMany({
    where: { userId: user.userId, ...(includeArchived ? {} : { archivedAt: null }) },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ accounts });
}

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const account = await prisma.account.create({
    data: {
      userId: user.userId,
      name: parsed.data.name,
      currency: parsed.data.currency.toUpperCase(),
      institution: parsed.data.institution || null
    }
  });

  return NextResponse.json({ account }, { status: 201 });
}
