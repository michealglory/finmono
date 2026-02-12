import { openai } from "@/server/ai/openai-client";
import { receiptPrompt, statementPrompt } from "@/server/ai/prompts";
import { receiptExtractionSchema, statementExtractionSchema } from "@/server/ai/schemas";

const MODEL = "gpt-4.1-mini";

const statementJsonSchema = {
  name: "statement_extraction",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      accountHint: { type: ["string", "null"] },
      transactions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            date: { type: "string" },
            description: { type: "string" },
            merchantName: { type: ["string", "null"] },
            amount: { type: "number" },
            currency: { type: "string" },
            direction: { type: "string", enum: ["INCOME", "EXPENSE"] },
            categoryHint: { type: ["string", "null"] }
          },
          required: ["date", "description", "amount", "currency", "direction", "merchantName", "categoryHint"]
        }
      }
    },
    required: ["accountHint", "transactions"]
  }
} as const;

const receiptJsonSchema = {
  name: "receipt_extraction",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      merchantName: { type: ["string", "null"] },
      date: { type: "string" },
      currency: { type: "string" },
      total: { type: "number" },
      lineItems: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            description: { type: "string" },
            quantity: { type: ["number", "null"] },
            unitPrice: { type: ["number", "null"] },
            amount: { type: "number" },
            categoryHint: { type: ["string", "null"] }
          },
          required: ["description", "quantity", "unitPrice", "amount", "categoryHint"]
        }
      }
    },
    required: ["merchantName", "date", "currency", "total", "lineItems"]
  }
} as const;

export async function extractStatementFromText(rawText: string) {
  if (!openai) throw new Error("OPENAI_API_KEY missing");

  const prompt = `Extract transactions from statement text:\n\n${rawText.slice(0, 120000)}`;

  const completion = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0,
    messages: [
      { role: "system", content: statementPrompt },
      { role: "user", content: prompt }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: statementJsonSchema.name,
        strict: true,
        schema: statementJsonSchema.schema
      }
    }
  });

  const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
  return {
    model: MODEL,
    prompt,
    parsed: statementExtractionSchema.parse(parsed)
  };
}

export async function extractReceiptFromText(rawText: string) {
  if (!openai) throw new Error("OPENAI_API_KEY missing");

  const prompt = `Extract receipt details from text:\n\n${rawText.slice(0, 120000)}`;

  const completion = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0,
    messages: [
      { role: "system", content: receiptPrompt },
      { role: "user", content: prompt }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: receiptJsonSchema.name,
        strict: true,
        schema: receiptJsonSchema.schema
      }
    }
  });

  const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
  return {
    model: MODEL,
    prompt,
    parsed: receiptExtractionSchema.parse(parsed)
  };
}

export async function extractReceiptFromImageOrPdf(base64Data: string, mimeType: string, filename: string) {
  if (!openai) throw new Error("OPENAI_API_KEY missing");

  const prompt = `Extract this receipt (${filename}) into JSON.`;

  const completion = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0,
    messages: [
      { role: "system", content: receiptPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${base64Data}` }
          }
        ]
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: receiptJsonSchema.name,
        strict: true,
        schema: receiptJsonSchema.schema
      }
    }
  });

  const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
  return {
    model: MODEL,
    prompt,
    parsed: receiptExtractionSchema.parse(parsed)
  };
}
