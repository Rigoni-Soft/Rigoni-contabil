import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

import type { DocumentoDoCartaoDto } from "@/modules/rh/application/dtos/documento-do-cartao.dto";
import type { GeradorDePdfDoCartaoPort } from "@/modules/rh/application/ports/out/gerador-de-pdf-do-cartao.provider";

// A4 em pontos, retrato: o mês inteiro (28 a 31 linhas), a Totalização e as duas assinaturas cabem numa página.
const LARGURA = 595.28;
const ALTURA = 841.89;
const MARGEM = 36;
const UTIL = LARGURA - 2 * MARGEM;
const ALTURA_DA_LINHA = 13;
const ALTURA_DA_IDENTIFICACAO = 74;
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

    this.identificacao(pincel, documento);
    const aposTabela = this.tabela(pincel, documento, MARGEM + ALTURA_DA_IDENTIFICACAO);
    this.totalizacao(pincel, documento, aposTabela);
    this.assinaturas(pincel, documento);
    return pdf.save();
  }

  private identificacao(pincel: Pincel, documento: DocumentoDoCartaoDto) {
    pincel.texto("Cartão de ponto", MARGEM, MARGEM + 14, 16, true);
    pincel.texto(`Empresa: ${documento.empresa}`, MARGEM, MARGEM + 32, 10);
    pincel.texto(`Empregado: ${documento.empregado}`, MARGEM, MARGEM + 46, 10, true);
    pincel.texto(`Período: ${documento.periodo}`, MARGEM, MARGEM + 60, 10);
  }

  private tabela(pincel: Pincel, documento: DocumentoDoCartaoDto, topo: number): number {
    pincel.retangulo(MARGEM, topo, UTIL, ALTURA_DA_LINHA + 3, CINZA);
    this.linha(
      pincel,
      topo + 11,
      COLUNAS.map((coluna) => coluna.titulo),
      true,
    );
    let y = topo + ALTURA_DA_LINHA + 3;
    for (const dia of documento.linhas) {
      this.linha(pincel, y + 10, [
        dia.data,
        dia.diaDaSemana,
        ...dia.batidas,
        dia.extra,
        dia.horasDiarias,
        dia.situacao,
      ]);
      y += ALTURA_DA_LINHA;
      pincel.traco(MARGEM, y, MARGEM + UTIL, y, 0.3);
    }
    return y + 14;
  }

  private linha(pincel: Pincel, baseline: number, celulas: string[], negrito = false) {
    let x = MARGEM;
    COLUNAS.forEach((coluna, i) => {
      pincel.texto(celulas[i] ?? "", x + 2, baseline, 7.5, negrito);
      x += coluna.largura;
    });
  }

  // O bloco que a pessoa confere antes de assinar: fundo azul claro, borda e valores em negrito.
  private totalizacao(pincel: Pincel, documento: DocumentoDoCartaoDto, topo: number) {
    const linhas = Math.ceil(documento.totalizacao.length / 2);
    const alturaDoBloco = 24 + linhas * 16;
    pincel.retangulo(MARGEM, topo, UTIL, alturaDoBloco, DESTAQUE, true);
    pincel.texto(`Totalização do mês (${documento.periodo})`, MARGEM + 8, topo + 15, 11, true);
    documento.totalizacao.forEach((item, i) => {
      const coluna = i % 2;
      const x = MARGEM + 8 + coluna * (UTIL / 2);
      const y = topo + 32 + Math.floor(i / 2) * 16;
      pincel.texto(`${item.rotulo}:`, x, y, 9);
      pincel.texto(item.valor, x + 140, y, 10, true);
    });
    if (documento.avisoDaTotalizacao) {
      pincel.texto(documento.avisoDaTotalizacao, MARGEM, topo + alturaDoBloco + 11, 7.5);
    }
  }

  private assinaturas(pincel: Pincel, documento: DocumentoDoCartaoDto) {
    const y = ALTURA - 60;
    const largura = (UTIL - 40) / 2;
    pincel.traco(MARGEM, y, MARGEM + largura, y, 0.8);
    pincel.traco(MARGEM + largura + 40, y, MARGEM + UTIL, y, 0.8);
    pincel.texto("Responsável da empresa (cliente)", MARGEM, y + 12, 8);
    pincel.texto(`Empregado: ${documento.empregado}`, MARGEM + largura + 40, y + 12, 8);
  }
}

// Desenha com a origem no canto superior esquerdo (o pdf-lib mede de baixo para cima).
class Pincel {
  constructor(
    private readonly pagina: PDFPage,
    private readonly normal: PDFFont,
    private readonly negrito: PDFFont,
  ) {}

  // A Helvetica padrão só codifica WinAnsi: o que ela não tem vira "?" (nome com emoji ou outro alfabeto não derruba
  // o PDF) e o texto que passa da largura útil é cortado com reticências.
  texto(texto: string, x: number, baseline: number, tamanho: number, negrito = false) {
    const fonte = negrito ? this.negrito : this.normal;
    const aceitos = new Set(fonte.getCharacterSet());
    let limpo = Array.from(texto, (c) => (aceitos.has(c.codePointAt(0)!) ? c : "?")).join("");
    const maximo = MARGEM + UTIL - x;
    while (limpo.length > 1 && fonte.widthOfTextAtSize(limpo, tamanho) > maximo) {
      limpo = `${limpo.slice(0, -2)}…`;
    }
    this.pagina.drawText(limpo, {
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
