import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/auth/require-user";
import { purgeDeletedTransactions } from "@/server/services/transaction-lifecycle";

const purgeSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("all_deleted") }),
  z.object({ mode: z.literal("selected"), ids: z.array(z.string()).min(1) }),
  z.object({ mode: z.literal("older_than"), before: z.string().min(1) })
]);

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const parsed = purgeSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result =
      parsed.data.mode === "older_than"
        ? await purgeDeletedTransactions(user.userId, {
            mode: "older_than",
            before: new Date(parsed.data.before)
          })
        : parsed.data.mode === "selected"
          ? await purgeDeletedTransactions(user.userId, {
              mode: "selected",
              ids: parsed.data.ids
            })
          : await purgeDeletedTransactions(user.userId, {
              mode: "all_deleted"
            });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Purge failed" }, { status: 400 });
  }
}
