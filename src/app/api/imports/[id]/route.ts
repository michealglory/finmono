import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const params = await context.params;
  const job = await prisma.importJob.findFirst({
    where: { id: params.id, userId: user.userId },
    include: {
      extractedRows: {
        include: {
          transaction: {
            include: { lineItems: true, account: true, category: true }
          }
        }
      },
      uploadedFile: true,
      user: {
        select: {
          aiAudits: {
            where: { importJobId: params.id },
            orderBy: { createdAt: "asc" }
          }
        }
      }
    }
  });

  if (!job) return NextResponse.json({ error: "Import not found" }, { status: 404 });

  return NextResponse.json({ job });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const params = await context.params;
  const body = (await request.json()) as { action: "confirm" | "reject" };

  if (body.action !== "confirm" && body.action !== "reject") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const job = await prisma.importJob.findFirst({ where: { id: params.id, userId: user.userId } });
  if (!job) return NextResponse.json({ error: "Import not found" }, { status: 404 });

  await prisma.importJob.update({
    where: { id: params.id },
    data: {
      status: body.action === "confirm" ? "COMPLETED" : "FAILED",
      errorSummary: body.action === "reject" ? "Rejected by user" : null
    }
  });

  return NextResponse.json({ ok: true });
}
