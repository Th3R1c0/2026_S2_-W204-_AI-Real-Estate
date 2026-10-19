import { PDFParse } from "pdf-parse";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return Response.json(
        { error: "No file provided. Please upload a PDF file." },
        { status: 400 },
      );
    }

    const fileBlob = file as Blob & { name?: string };

    if (fileBlob.size > MAX_FILE_SIZE) {
      return Response.json(
        { error: "File exceeds maximum size of 15MB." },
        { status: 413 },
      );
    }

    const arrayBuffer = await fileBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Verify PDF magic header "%PDF-"
    const magicHeader = buffer.subarray(0, 5).toString("ascii");
    if (magicHeader !== "%PDF-") {
      return Response.json(
        { error: "Invalid file format. Please upload a valid PDF document." },
        { status: 400 },
      );
    }

    const parser = new PDFParse({ data: buffer });
    let text = "";
    let pageCount = 1;

    try {
      const parsed = await parser.getText();
      text = parsed.text?.trim() ?? "";
      pageCount = parsed.total || (parsed.pages ? parsed.pages.length : 1);
    } catch {
      return Response.json(
        { error: "Unable to parse PDF content. Please check if the file is encrypted or corrupted." },
        { status: 422 },
      );
    } finally {
      try {
        await parser.destroy();
      } catch {
        // ignore cleanup error
      }
    }

    const filename = fileBlob.name || "lim-report.pdf";
    let warning: string | undefined;

    if (text.length < 50) {
      warning = "Notice: Very little text could be extracted from this PDF. Scanned image-only PDFs may require OCR.";
    }

    return Response.json({
      filename,
      pageCount,
      text,
      warning,
    });
  } catch (err: unknown) {
    console.error("[Upload LIM] Error processing PDF upload:", err);
    return Response.json(
      { error: "Internal error processing uploaded document." },
      { status: 500 },
    );
  }
}
