/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { POST } from "../app/api/chatbot/upload-lim/route";

const sampleValidPdfString =
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>/Contents 4 0 R>>endobj\n4 0 obj<</Length 70>>stream\nBT\n/F1 12 Tf\n100 700 Td\n(Auckland Council LIM Report: Building Consent Approved CCC-123456) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \n0000000212 00000 n \ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n331\n%%EOF";

describe("POST /api/chatbot/upload-lim (TDD)", () => {
  it("rejects request if no file is uploaded", async () => {
    const formData = new FormData();
    const req = new Request("http://localhost/api/chatbot/upload-lim", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/no file provided/i);
  });

  it("rejects non-PDF files that lack the %PDF- magic bytes", async () => {
    const formData = new FormData();
    const fakeFile = new File(["This is just plain text"], "notes.txt", {
      type: "text/plain",
    });
    formData.append("file", fakeFile);

    const req = new Request("http://localhost/api/chatbot/upload-lim", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/invalid file format|valid pdf/i);
  });

  it("rejects files that exceed the 15MB limit", async () => {
    const formData = new FormData();
    const oversizedBlob = new Blob([new Uint8Array(15 * 1024 * 1024 + 10)], {
      type: "application/pdf",
    });

    formData.append("file", oversizedBlob as unknown as File, "huge-lim.pdf");

    const req = new Request("http://localhost/api/chatbot/upload-lim", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(413);
    const data = await res.json();
    expect(data.error).toMatch(/maximum size of 15mb/i);
  });

  it("successfully parses a valid PDF and extracts text & pageCount", async () => {
    const formData = new FormData();
    const pdfBlob = new Blob([sampleValidPdfString], { type: "application/pdf" });
    formData.append("file", pdfBlob as unknown as File, "12-queen-street-lim.pdf");

    const req = new Request("http://localhost/api/chatbot/upload-lim", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.filename).toBe("12-queen-street-lim.pdf");
    expect(data.pageCount).toBe(1);
    expect(data.text).toContain("Auckland Council LIM Report");
    expect(data.text).toContain("Building Consent");
  });
});
