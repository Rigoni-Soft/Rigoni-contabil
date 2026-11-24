import type {
  LeitorDeParcelamentoPort,
  LeituraDeParcelamento,
} from "@/modules/clientes/application/ports/out/leitor-de-parcelamento.provider";
import type { RegistroDeErrosPort } from "@/modules/clientes/application/ports/out/registro-de-erros.provider";
import { ConsoleRegistroDeErrosGateway } from "@/modules/clientes/infra/gateways/console-registro-de-erros.gateway";

import { centavos, dataIso, extrairTextoDoPdf, pega } from "./leitura-pdf.gateway";

type Lida = Omit<
  Extract<LeituraDeParcelamento, { lido: true }>,
  "cnpj" | "quantidadeDeParcelas" | "totalDeParcelas"
> & { parcelas: number };

const ILEGIVEL: LeituraDeParcelamento = { lido: false, motivo: "ilegivel" };

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

export class LeitorDeParcelamentoTextoGateway implements LeitorDeParcelamentoPort {
  constructor(
    private readonly extrairTexto: (pdf: Uint8Array) => Promise<string> = extrairTextoDoPdf,
    private readonly erros: RegistroDeErrosPort = new ConsoleRegistroDeErrosGateway(),
  ) {}

  async ler(pdf: Uint8Array): Promise<LeituraDeParcelamento> {
    try {
      return interpretar((await this.extrairTexto(pdf)).replace(/\s+/g, " ").trim());
    } catch {
      this.erros.registrar("Leitor de PDF: falha ao extrair o texto do PDF.");
      return ILEGIVEL;
    }
  }
}
