import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/auth/require-user";
import { archiveAccount } from "@/server/services/account-management";

const schema = z.object({ action: z.enum(["archive", "unarchive"]) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const params = await context.params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const account = await archiveAccount(user.userId, params.id, parsed.data.action === "archive");
    return NextResponse.json({ account });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Archive failed" }, { status: 400 });
  }
}
