import Papa from "papaparse";
import * as XLSX from "xlsx";
import pdfParse from "pdf-parse";

export type ParsedRow = Record<string, string>;

export function parseCsv(buffer: Buffer): ParsedRow[] {
  const text = buffer.toString("utf8");
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim()
  });

  return parsed.data;
}

export function parseXlsx(buffer: Buffer): ParsedRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheet = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheet];
  const matrix = XLSX.utils.sheet_to_json<Array<string | number | null>>(sheet, {
    header: 1,
    defval: ""
  }) as Array<Array<string | number | null>>;

  if (matrix.length === 0) return [];

  const normalize = (value: unknown) => String(value ?? "").trim();
  const headerKeywords = ["date", "description", "narration", "debit", "credit", "amount", "balance", "reference"];
  const firstRow = matrix[0].map(normalize);
  const firstRowLooksLikeHeader = firstRow.some((cell) =>
    headerKeywords.some((keyword) => cell.toLowerCase().includes(keyword))
  );

  if (firstRowLooksLikeHeader) {
    return XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
  }

  // Fallback for headerless exports (common in mobile-wallet statement dumps).
  const keys = ["date_time", "date", "description", "debit", "credit", "balance", "channel", "reference"];
  return matrix
    .map((row) => {
      const out: ParsedRow = {};
      keys.forEach((key, idx) => {
        out[key] = normalize(row[idx]);
      });
      return out;
    })
    .filter((row) => row.description || row.date || row.date_time);
}

export async function parsePdfText(buffer: Buffer): Promise<string> {
  const parsed = await pdfParse(buffer);
  return parsed.text || "";
}

export function parseRawText(buffer: Buffer): string {
  return buffer.toString("utf8");
}
