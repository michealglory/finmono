import { NextResponse } from "next/server";
import { JobType } from "@prisma/client";
import { requireUser } from "@/server/auth/require-user";
import { enqueueImportJob } from "@/server/services/imports";
import { publishJob } from "@/server/services/queue";
import { saveUploadedFile } from "@/server/services/uploads";

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Statement file is required" }, { status: 400 });
  }

  try {
    const upload = await saveUploadedFile(user.userId, file);
    const job = await enqueueImportJob({ userId: user.userId, uploadedFileId: upload.id, type: JobType.STATEMENT_IMPORT });
    await publishJob("statement-import", { jobId: job.id });
    return NextResponse.json({ jobId: job.id }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not start statement import" },
      { status: 400 }
    );
  }
}
