// lib/files/extract.ts
import pdfParse from "pdf-parse-fork";
import mammoth from "mammoth";

export async function extractTextFromFile(
  base64: string,
  mimeType: string
): Promise<string> {
  const buffer = Buffer.from(base64, "base64");

  switch (mimeType) {
    case "application/pdf": {
      try {
        const data = await pdfParse(buffer);
        return data.text;
      } catch (error) {
        console.error("PDF extraction error:", error);
        return `[Erreur lors de l'extraction du PDF]`;
      }
    }

    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      try {
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
      } catch (error) {
        console.error("Word extraction error:", error);
        return `[Erreur lors de l'extraction du document Word]`;
      }
    }

    case "text/plain":
    case "text/csv":
    case "application/json":
    case "text/x-python":
    case "application/x-python":
    case "text/javascript":
    case "application/javascript":
    case "text/markdown":
    case "application/xml":
    case "text/xml":
      return buffer.toString("utf-8");

    default:
      return `[Fichier de type ${mimeType} - impossible d'extraire le texte]`;
  }
}