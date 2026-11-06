/** @jest-environment node */
import { PDFDocument } from "pdf-lib";

import { PDF_BASE64 } from "./pdf-teste.mjs";

describe("PDF do mock fiscal", () => {
  it("decodifica de base64 e abre como PDF com ao menos 1 página", async () => {
    const bytes = Buffer.from(PDF_BASE64, "base64");
    expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");

    const documento = await PDFDocument.load(bytes, { throwOnInvalidObject: true });

    expect(documento.getPageCount()).toBeGreaterThan(0);
  });
});
