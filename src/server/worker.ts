import PgBoss from "pg-boss";
import { env } from "@/lib/env";
import { processReceiptImport, processStatementImport } from "@/server/services/imports";

const boss = new PgBoss(env.DATABASE_URL);

async function start() {
  await boss.start();

  await boss.work("statement-import", async (jobs) => {
    const batch = Array.isArray(jobs) ? jobs : [jobs];
    for (const job of batch) {
      await processStatementImport(String((job.data as { jobId: string }).jobId));
    }
  });

  await boss.work("receipt-import", async (jobs) => {
    const batch = Array.isArray(jobs) ? jobs : [jobs];
    for (const job of batch) {
      await processReceiptImport(String((job.data as { jobId: string }).jobId));
    }
  });

  console.log("worker started");
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
