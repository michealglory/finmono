import PgBoss from "pg-boss";
import { env } from "@/lib/env";
import { processReceiptImport, processStatementImport } from "@/server/services/imports";

const boss = new PgBoss(env.DATABASE_URL);

async function start() {
  await boss.start();

  await boss.work("statement-import", async (job) => {
    await processStatementImport(String(job.data.jobId));
  });

  await boss.work("receipt-import", async (job) => {
    await processReceiptImport(String(job.data.jobId));
  });

  // eslint-disable-next-line no-console
  console.log("worker started");
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
