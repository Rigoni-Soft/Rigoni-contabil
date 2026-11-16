import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

import type { DocumentoDoCartaoDto } from "@/modules/rh/application/dtos/documento-do-cartao.dto";
import type { GeradorDePdfDoCartaoPort } from "@/modules/rh/application/ports/out/gerador-de-pdf-do-cartao.provider";

// A4 em pontos, retrato: o mês inteiro (28 a 31 linhas), a Totalização e as duas assinaturas cabem numa página.
const LARGURA = 595.28;
const ALTURA = 841.89;
const MARGEM = 36;
const UTIL = LARGURA - 2 * MARGEM;
const ALTURA_DA_LINHA = 13;
const PRETO = rgb(0.1, 0.1, 0.1);
const CINZA = rgb(0.9, 0.9, 0.9);
const DESTAQUE = rgb(0.86, 0.92, 1);

const COLUNAS = [
  { titulo: "Data", largura: 36 },
  { titulo: "Dia", largura: 30 },
  { titulo: "Entrada", largura: 44 },
  { titulo: "Saída", largura: 44 },
  { titulo: "Entrada", largura: 44 },
  { titulo: "Saída", largura: 44 },
  { titulo: "Extra", largura: 72 },
  { titulo: "H. Diária", largura: 50 },
  { titulo: "Situação", largura: UTIL - 364 },
];

// Gera o PDF individual do Cartão de ponto: identificação, um dia por linha, a Totalização do mês em destaque e as
// linhas de assinatura física. Só desenha o que o DTO já traz em texto.
export class PdfLibGeradorDoCartaoGateway implements GeradorDePdfDoCartaoPort {
  async gerar(documento: DocumentoDoCartaoDto): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    pdf.setTitle(`Cartão de ponto de ${documento.empregado}, ${documento.periodo}`);
    pdf.setProducer("Rigoni Contabilidade");
    const normal = await pdf.embedFont(StandardFonts.Helvetica);
    const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
    const pagina = pdf.addPage([LARGURA, ALTURA]);
    const pincel = new Pincel(pagina, normal, negrito);

    let topo = MARGEM;
    topo = this.identificacao(pincel, documento, topo);
    topo = this.tabela(pincel, documento, topo);
    topo = this.totalizacao(pincel, documento, topo);
    this.assinaturas(pincel, documento);
    return pdf.save();
  }

  private identificacao(p: Pincel, d: DocumentoDoCartaoDto, topo: number): number {
    p.texto("Cartão de ponto", MARGEM, topo + 14, 16, true);
    p.texto(`Empresa: ${d.empresa}`, MARGEM, topo + 32, 10);
    p.texto(`Empregado: ${d.empregado}`, MARGEM, topo + 46, 10, true);
    p.texto(`Período: ${d.periodo}`, MARGEM, topo + 60, 10);
    return topo + 74;
  }

  private tabela(p: Pincel, d: DocumentoDoCartaoDto, topo: number): number {
    p.retangulo(MARGEM, topo, UTIL, ALTURA_DA_LINHA + 3, CINZA);
    this.linha(
      p,
      topo + 11,
      COLUNAS.map((c) => c.titulo),
      true,
    );
    let y = topo + ALTURA_DA_LINHA + 3;
    for (const dia of d.linhas) {
      this.linha(p, y + 10, [
        dia.data,
        dia.diaDaSemana,
        ...dia.batidas,
        dia.extra,
        dia.horasDiarias,
        dia.situacao,
      ]);
      y += ALTURA_DA_LINHA;
      p.traco(MARGEM, y, MARGEM + UTIL, y, 0.3);
    }
    return y + 14;
  }

  private linha(p: Pincel, baseline: number, celulas: string[], negrito = false) {
    let x = MARGEM;
    COLUNAS.forEach((coluna, i) => {
      p.texto(celulas[i] ?? "", x + 2, baseline, 7.5, negrito);
      x += coluna.largura;
    });
  }

  // O bloco que a pessoa confere antes de assinar: fundo azul claro, borda e valores em negrito.
  private totalizacao(p: Pincel, d: DocumentoDoCartaoDto, topo: number): number {
    const linhas = Math.ceil(d.totalizacao.length / 2);
    const alturaDoBloco = 24 + linhas * 16;
    p.retangulo(MARGEM, topo, UTIL, alturaDoBloco, DESTAQUE, true);
    p.texto(`Totalização do mês (${d.periodo})`, MARGEM + 8, topo + 15, 11, true);
    d.totalizacao.forEach((item, i) => {
      const coluna = i % 2;
      const x = MARGEM + 8 + coluna * (UTIL / 2);
      const y = topo + 32 + Math.floor(i / 2) * 16;
      p.texto(`${item.rotulo}:`, x, y, 9);
      p.texto(item.valor, x + 140, y, 10, true);
    });
    let fim = topo + alturaDoBloco;
    if (d.avisoDaTotalizacao) {
      p.texto(d.avisoDaTotalizacao, MARGEM, fim + 11, 7.5);
      fim += 14;
    }
    return fim;
  }

  private assinaturas(p: Pincel, d: DocumentoDoCartaoDto) {
    const y = ALTURA - 60;
    const largura = (UTIL - 40) / 2;
    p.traco(MARGEM, y, MARGEM + largura, y, 0.8);
    p.traco(MARGEM + largura + 40, y, MARGEM + UTIL, y, 0.8);
    p.texto("Responsável da empresa (cliente)", MARGEM, y + 12, 8);
    p.texto(`Empregado: ${d.empregado}`, MARGEM + largura + 40, y + 12, 8);
  }
}

// Desenha com a origem no canto superior esquerdo (o pdf-lib mede de baixo para cima).
class Pincel {
  constructor(
    private readonly pagina: PDFPage,
    private readonly normal: PDFFont,
    private readonly negrito: PDFFont,
  ) {}

  texto(texto: string, x: number, baseline: number, tamanho: number, negrito = false) {
    const fonte = negrito ? this.negrito : this.normal;
    this.pagina.drawText(texto, {
      x,
      y: ALTURA - baseline,
      size: tamanho,
      font: fonte,
      color: PRETO,
    });
  }

  retangulo(
    x: number,
    topo: number,
    largura: number,
    altura: number,
    cor: ReturnType<typeof rgb>,
    borda = false,
  ) {
    this.pagina.drawRectangle({
      x,
      y: ALTURA - topo - altura,
      width: largura,
      height: altura,
      color: cor,
      ...(borda ? { borderColor: PRETO, borderWidth: 0.8 } : {}),
    });
  }

  traco(x1: number, y1: number, x2: number, y2: number, espessura: number) {
    this.pagina.drawLine({
      start: { x: x1, y: ALTURA - y1 },
      end: { x: x2, y: ALTURA - y2 },
      thickness: espessura,
      color: PRETO,
    });
  }
}
