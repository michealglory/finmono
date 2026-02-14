import PgBoss from "pg-boss";
import { env } from "@/lib/env";

let boss: PgBoss | null = null;
const ensuredQueues = new Set<string>();

async function getBoss() {
  if (boss) return boss;
  boss = new PgBoss(env.DATABASE_URL);
  await boss.start();
  return boss;
}

export async function publishJob(name: "statement-import" | "receipt-import", payload: { jobId: string }) {
  const activeBoss = await getBoss();
  if (!ensuredQueues.has(name)) {
    await activeBoss.createQueue(name);
    ensuredQueues.add(name);
  }
  const id = await activeBoss.send(name, payload);
  if (!id) {
    throw new Error(`Failed to enqueue job for queue ${name}`);
  }
}
