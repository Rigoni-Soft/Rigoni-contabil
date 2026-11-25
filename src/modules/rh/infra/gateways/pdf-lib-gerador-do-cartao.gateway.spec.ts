import { decodePDFRawStream, PDFArray, PDFDocument, PDFRawStream } from "pdf-lib";

import type { DocumentoDoCartaoDto } from "@/modules/rh/application/dtos/documento-do-cartao.dto";
import { PdfLibGeradorDoCartaoGateway } from "@/modules/rh/infra/gateways/pdf-lib-gerador-do-cartao.gateway";

const DOCUMENTO: DocumentoDoCartaoDto = {
  empresa: "Padaria Teste Ltda",
  empregado: "Maria da Conceição",
  periodo: "11/2026",
  linhas: [
    {
      data: "03/11",
      diaDaSemana: "ter",
      batidas: ["08:00", "12:00", "13:00", "18:00"],
      extra: "",
      horasDiarias: "9h00",
      situacao: "",
    },
    {
      data: "04/11",
      diaDaSemana: "qua",
      batidas: ["", "", "", ""],
      extra: "",
      horasDiarias: "0h00",
      situacao: "Abono",
    },
    {
      data: "05/11",
      diaDaSemana: "qui",
      batidas: ["", "", "", ""],
      extra: "",
      horasDiarias: "0h00",
      situacao: "Falta",
    },
  ],
  totalizacao: [
    { rotulo: "Horas trabalhadas", valor: "9h00" },
    { rotulo: "Extras 50%", valor: "0h15" },
    { rotulo: "Faltas", valor: "1 dia" },
    { rotulo: "Abonos", valor: "1 dia · 8h45" },
  ],
  avisoDaTotalizacao: "Sem convenção coletiva vigente em parte do mês.",
};

async function textoDo(pdf: Uint8Array): Promise<string> {
  const documento = await PDFDocument.load(pdf);
  const conteudo = documento.getPage(0).node.Contents();
  const partes = conteudo instanceof PDFArray ? conteudo.asArray() : [conteudo];
  const linhas: string[] = [];
  for (const ref of partes) {
    const fluxo = documento.context.lookup(ref);
    if (!(fluxo instanceof PDFRawStream)) continue;
    const comandos = Buffer.from(decodePDFRawStream(fluxo).decode()).toString("latin1");
    for (const [, hex] of comandos.matchAll(/<([0-9A-F]*)>\s*Tj/g)) {
      linhas.push(Buffer.from(hex, "hex").toString("latin1"));
    }
  }
  return linhas.join("\n");
}

const paginas = async (pdf: Uint8Array) => (await PDFDocument.load(pdf)).getPageCount();

describe("PdfLibGeradorDoCartaoGateway", () => {
  it("gera um PDF de uma página com identificação, dias, abono, falta e a Totalização", async () => {
    const pdf = await new PdfLibGeradorDoCartaoGateway().gerar(DOCUMENTO);

    expect(Buffer.from(pdf.slice(0, 5)).toString()).toBe("%PDF-");
    expect(await paginas(pdf)).toBe(1);

    const texto = await textoDo(pdf);
    expect(texto).toContain("Cartão de ponto");
    expect(texto).toContain("Padaria Teste Ltda");
    expect(texto).toContain("Maria da Conceição");
    expect(texto).toContain("11/2026");
    expect(texto).toContain("03/11");
    expect(texto).toContain("08:00");
    expect(texto).toContain("Abono");
    expect(texto).toContain("Falta");
    expect(texto).toContain("Totalização do mês");
    expect(texto).toContain("Extras 50%");
    expect(texto).toContain("0h15");
    expect(texto).toContain("1 dia · 8h45");
    expect(texto).toContain("Sem convenção coletiva vigente");
  });

  it("traz as duas linhas de assinatura, a do responsável e a do empregado", async () => {
    const texto = await textoDo(await new PdfLibGeradorDoCartaoGateway().gerar(DOCUMENTO));

    expect(texto).toContain("Responsável da empresa (cliente)");
    expect(texto).toContain("Empregado: Maria da Conceição");
  });

  it("nome com caractere fora do WinAnsi não derruba o PDF: o que a fonte não tem vira ?", async () => {
    const pdf = await new PdfLibGeradorDoCartaoGateway().gerar({
      ...DOCUMENTO,
      empregado: "Zoë 😀 李",
    });

    const texto = await textoDo(pdf);
    expect(texto).toContain("Empregado: Zoë ? ?");
  });

  it("nome longo é cortado com reticências para não passar da margem", async () => {
    const longo = "Maria ".repeat(40).trim();

    const texto = await textoDo(
      await new PdfLibGeradorDoCartaoGateway().gerar({ ...DOCUMENTO, empresa: longo }),
    );

    const linha = texto.split("\n").find((t) => t.startsWith("Empresa: "));
    expect(linha).toMatch(/\u0085$/);
    expect(linha!.length).toBeLessThan(longo.length);
  });

  it("um mês de 31 dias segue numa página só, com a Totalização e as assinaturas", async () => {
    const linhas = Array.from({ length: 31 }, (_, i) => ({
      ...DOCUMENTO.linhas[0],
      data: `${String(i + 1).padStart(2, "0")}/12`,
    }));

    const pdf = await new PdfLibGeradorDoCartaoGateway().gerar({ ...DOCUMENTO, linhas });

    expect(await paginas(pdf)).toBe(1);
    const texto = await textoDo(pdf);
    expect(texto).toContain("31/12");
    expect(texto).toContain("Totalização do mês");
    expect(texto).toContain("Responsável da empresa (cliente)");
  });
});
