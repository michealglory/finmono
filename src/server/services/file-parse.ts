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
  return XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
}

export async function parsePdfText(buffer: Buffer): Promise<string> {
  const parsed = await pdfParse(buffer);
  return parsed.text || "";
}

export function parseRawText(buffer: Buffer): string {
  return buffer.toString("utf8");
}
