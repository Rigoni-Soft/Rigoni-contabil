import type {
  LeitorDeParcelamentoPort,
  LeituraDeParcelamento,
} from "@/modules/clientes/application/ports/out/leitor-de-parcelamento.provider";

import { centavos, dataIso, extrairTextoDoPdf, pega } from "./leitura-pdf.util";

// O que cada parser lê; `interpretar` completa o que é igual nos dois modelos (CNPJ e o total de parcelas).
type Lida = Omit<
  Extract<LeituraDeParcelamento, { lido: true }>,
  "cnpj" | "quantidadeDeParcelas" | "totalDeParcelas"
> & { parcelas: number };

const ILEGIVEL: LeituraDeParcelamento = { lido: false, motivo: "ilegivel" };

// Recibo de Adesão ao Parcelamento do Simples Nacional (Receita Federal): não imprime código.
function lerReceita(texto: string): Lida | null {
  const parcelas = Number(pega(texto, /Número de parcelas:\s*(\d+)/));
  if (!parcelas) return null;
  return {
    lido: true,
    codigo: null,
    parcelas,
    origem: "receita_federal",
    valorDaParcelaCentavos: centavos(
      pega(texto, /Valor das demais parcelas:\s*R\$\s*([\d.,]+)/) ??
        pega(texto, /Valor da primeira parcela:\s*R\$\s*([\d.,]+)/),
    ),
    dataDeAdesao: dataIso(pega(texto, /Confirmação recebida[\s\S]*?\bem (\d{2}\/\d{2}\/\d{4})/)),
  };
}

// Recibo de Adesão e Consolidação de Negociação (PGFN, SISPAR/Regularize): o código é o número da
// conta de negociação; não há total de parcelas, então soma a entrada e as prestações da tabela
// "Demonstrativo de pagamento da entrada e prestações".
function lerPgfn(texto: string): Lida | null {
  const tabela = pega(
    texto,
    /ENTRADA E PRESTAÇÕES\s+TIPO DE PAGAMENTO QUANTIDADE VALOR\s+(.*?)\s+Todos os valores/,
  );
  const linhas = [...(tabela ?? "").matchAll(/([A-ZÀ-Ú]+)\s+(\d+)x\s+([\d.,]+)/g)].map((m) => ({
    tipo: m[1],
    quantidade: Number(m[2]),
    valor: m[3],
  }));
  const total = linhas.reduce((soma, l) => soma + l.quantidade, 0);
  if (total < 1) return null;
  // O valor da parcela é o das prestações; a entrada só vale se for a única linha.
  const prestacao = linhas.find((l) => l.tipo !== "ENTRADA") ?? linhas[0];
  return {
    lido: true,
    codigo: pega(texto, /Número da conta de negociação:\s*(\d+)/) ?? null,
    parcelas: total,
    origem: "pgfn",
    valorDaParcelaCentavos: centavos(prestacao.valor),
    dataDeAdesao: dataIso(pega(texto, /informações prestadas em (\d{2}\/\d{2}\/\d{4})/)),
  };
}

// Um parser por modelo conhecido (o texto traz o marcador do órgão). ponytail: modelo novo ou PDF
// escaneado (sem camada de texto) cai em `ilegivel` e a tela pede digitação à mão; modelo novo =
// parser novo aqui, escaneado = OCR, só se aparecer na prática.
function interpretar(texto: string): LeituraDeParcelamento {
  const lida = /RECIBO DE ADESÃO AO PARCELAMENTO DO SIMPLES NACIONAL/i.test(texto)
    ? lerReceita(texto)
    : /Número da conta de negociação/i.test(texto)
      ? lerPgfn(texto)
      : null;
  if (!lida) return ILEGIVEL;
  const { parcelas, ...resto } = lida;
  return {
    ...resto,
    quantidadeDeParcelas: parcelas,
    totalDeParcelas: parcelas,
    cnpj: pega(texto, /CNPJ\s*:\s*([0-9A-Z./-]{14,18})/) ?? null,
  };
}

// Lê direto a camada de texto do PDF (sem API externa: o dado fiscal não sai do servidor).
export class LeitorDeParcelamentoTextoGateway implements LeitorDeParcelamentoPort {
  constructor(
    private readonly extrairTexto: (pdf: Uint8Array) => Promise<string> = extrairTextoDoPdf,
  ) {}

  async ler(pdf: Uint8Array): Promise<LeituraDeParcelamento> {
    try {
      return interpretar((await this.extrairTexto(pdf)).replace(/\s+/g, " ").trim());
    } catch {
      console.error("Leitor de PDF: falha ao extrair o texto do PDF.");
      return ILEGIVEL;
    }
  }
}
