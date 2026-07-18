import { createRequire } from "node:module";
import mammoth from "mammoth";
import { createWorker } from "tesseract.js";
import { logger } from "../lib/logger.js";

const require = createRequire(import.meta.url);

export type SupportedImportMimeType =
  | "application/pdf"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  | "image/png"
  | "image/jpeg"
  | "image/webp";

export function isSupportedImportMimeType(mimeType: string): mimeType is SupportedImportMimeType {
  return [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/png",
    "image/jpeg",
    "image/webp"
  ].includes(mimeType);
}

async function extractFromPdf(buffer: Buffer): Promise<string> {
  // pdf-parse v2 ships as CJS; dynamic require avoids ESM interop issues under Node 22.
  const { PDFParse } = require("pdf-parse") as typeof import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function extractFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractFromImage(buffer: Buffer): Promise<string> {
  const worker = await createWorker("eng");
  try {
    const { data } = await worker.recognize(buffer);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

export async function extractTextFromFile(buffer: Buffer, mimeType: SupportedImportMimeType): Promise<string> {
  try {
    switch (mimeType) {
      case "application/pdf":
        return await extractFromPdf(buffer);
      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return await extractFromDocx(buffer);
      case "image/png":
      case "image/jpeg":
      case "image/webp":
        return await extractFromImage(buffer);
      default:
        return "";
    }
  } catch (error) {
    logger.warn({ error, mimeType }, "Failed to extract text from uploaded file");
    return "";
  }
}
