import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  JWT_SECRET: z.string().min(32),
  OPENAI_API_KEY: z.string().optional().default(""),
  BASE_CURRENCY: z.string().default("NGN"),
  FX_PROVIDER_URL: z.string().url().default("https://open.er-api.com/v6/latest"),
  MAX_UPLOAD_MB: z.coerce.number().min(1).max(50).default(12),
  UPLOAD_DIR: z.string().default("./storage/uploads")
});

export const env = envSchema.parse(process.env);
