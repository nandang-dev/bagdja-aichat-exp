import * as mammoth from "mammoth";
import * as textract from "textract";

export async function parseDocx(filePath: string): Promise<string> {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

export function parseDoc(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    textract.fromFileWithPath(filePath, (error, text) => {
      if (error) reject(error);
      else resolve(text);
    });
  });
}