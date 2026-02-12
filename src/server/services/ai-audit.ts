import { prisma } from "@/lib/prisma";

export async function logAIAudit(params: {
  userId: string;
  importJobId?: string;
  model: string;
  purpose: string;
  prompt: string;
  responseJson: unknown;
}) {
  await prisma.aIAudit.create({
    data: {
      userId: params.userId,
      importJobId: params.importJobId,
      model: params.model,
      purpose: params.purpose,
      prompt: params.prompt,
      responseJson: params.responseJson as never
    }
  });
}
