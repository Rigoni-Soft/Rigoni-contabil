import type {
  LeitorDeGuiaDeParcelaPort,
  LeituraDeGuia,
} from "@/modules/clientes/application/ports/out/leitor-de-guia-de-parcela.provider";

import { centavos, dataIso, extrairTextoDoPdf, pega } from "./leitor-de-parcelamento-texto.gateway";

const NAO_LIDA: LeituraDeGuia = { lido: false };

// ponytail: um modelo só, o DAS do SENDA (entrada e parcela mensal têm o mesmo). Outro modelo, PDF
// escaneado (sem camada de texto) ou corrompido cai em `lido: false` e a guia fica "a confirmar";
// modelo novo = parser novo aqui, escaneado = OCR, só se aparecer na prática.
function interpretar(texto: string): LeituraDeGuia {
  if (!/Documento de Arrecadação do Simples Nacional/i.test(texto)) return NAO_LIDA;
  const periodo = /Período de Apuração\s*:?\s*(\d{2})\/(\d{4})/.exec(texto);
  return {
    lido: true,
    cnpj: pega(texto, /CNPJ\s*:?\s*([0-9A-Z./-]{14,18})/) ?? null,
    contaNegociacao: pega(texto, /PGFN-SISPAR\s*:?\s*(\d+)/) ?? null,
    competencia: periodo ? `${periodo[2]}${periodo[1]}` : null,
    vencimento: dataIso(pega(texto, /Data de Vencimento\s*:?\s*(\d{2}\/\d{2}\/\d{4})/)),
    valorCentavos: centavos(pega(texto, /Valor Total do Documento\s*:?\s*R\$\s*([\d.,]+)/)),
  };
}

// Lê direto a camada de texto do PDF (sem API externa: o dado fiscal não sai do servidor).
export class LeitorDeGuiaDeParcelaTextoGateway implements LeitorDeGuiaDeParcelaPort {
  constructor(
    private readonly extrairTexto: (pdf: Uint8Array) => Promise<string> = extrairTextoDoPdf,
  ) {}

  async ler(pdf: Uint8Array): Promise<LeituraDeGuia> {
    try {
      return interpretar((await this.extrairTexto(pdf)).replace(/\s+/g, " ").trim());
    } catch {
      console.error("Leitor de guia: falha ao extrair o texto do PDF.");
      return NAO_LIDA;
    }
  }
}
