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
    return NextResponse.json({ error: "Receipt file is required" }, { status: 400 });
  }

  try {
    const upload = await saveUploadedFile(user.userId, file);
    const job = await enqueueImportJob({ userId: user.userId, uploadedFileId: upload.id, type: JobType.RECEIPT_IMPORT });
    await publishJob("receipt-import", { jobId: job.id });
    return NextResponse.json({ jobId: job.id }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not start receipt import" },
      { status: 400 }
    );
  }
}
