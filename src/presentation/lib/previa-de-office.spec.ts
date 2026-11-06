/**
 * @jest-environment node
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { docxParaHtml, xlsxParaTabela } from "./previa-de-office";

// O navegador usa o build `mammoth.browser` (lê `arrayBuffer`); o do Node só lê arquivo/buffer.
jest.mock("mammoth", () => jest.requireActual("mammoth/mammoth.browser"));

const arquivo = (nome: string) => {
  const bytes = readFileSync(join(__dirname, "fixtures", nome));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
};

describe("previa-de-office", () => {
  it("docx vira HTML com os parágrafos", async () => {
    const html = await docxParaHtml(arquivo("exemplo.docx"));
    expect(html).toContain("<p>Contrato de prestação de serviços</p>");
    expect(html).toContain("Cláusula primeira");
  });

  it("xlsx vira tabela da primeira planilha, com número como texto", async () => {
    expect(await xlsxParaTabela(arquivo("exemplo.xlsx"))).toEqual({
      nome: "Balancete",
      linhas: [
        ["Conta", "Saldo"],
        ["Caixa", "1500.5"],
      ],
      truncada: false,
    });
  });

  it("arquivo que não é Office recusa com erro", async () => {
    await expect(docxParaHtml(new TextEncoder().encode("nao sou docx").buffer)).rejects.toThrow();
    await expect(xlsxParaTabela(new TextEncoder().encode("nao sou xlsx").buffer)).rejects.toThrow();
  });
});
