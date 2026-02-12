import PgBoss from "pg-boss";
import { env } from "@/lib/env";

let boss: PgBoss | null = null;

async function getBoss() {
  if (boss) return boss;
  boss = new PgBoss(env.DATABASE_URL);
  await boss.start();
  return boss;
}

export async function publishJob(name: "statement-import" | "receipt-import", payload: { jobId: string }) {
  const activeBoss = await getBoss();
  await activeBoss.send(name, payload);
}
