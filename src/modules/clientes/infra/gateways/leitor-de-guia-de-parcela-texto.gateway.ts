import type {
  LeitorDeGuiaDeParcelaPort,
  LeituraDeGuia,
} from "@/modules/clientes/application/ports/out/leitor-de-guia-de-parcela.provider";
import type { RegistroDeErrosPort } from "@/modules/clientes/application/ports/out/registro-de-erros.provider";
import { ConsoleRegistroDeErrosGateway } from "@/modules/clientes/infra/gateways/console-registro-de-erros.gateway";

import { centavos, dataIso, extrairTextoDoPdf, pega } from "./leitura-pdf.gateway";

const NAO_LIDA: LeituraDeGuia = { lido: false };
const CNPJ_NO_TEXTO = /CNPJ\s*:?\s*([0-9A-Z./-]{14,18})/;
const juntarEspacos = (texto: string) => texto.replace(/\s+/g, " ").trim();

function interpretar(texto: string): LeituraDeGuia {
  if (!/Documento de Arrecadação do Simples Nacional/i.test(texto) || !/PGFN-SISPAR/.test(texto)) {
    return NAO_LIDA;
  }
  const periodo = /Período de Apuração\s*:?\s*(\d{2})\/(\d{4})/.exec(texto);
  return {
    lido: true,
    cnpj: pega(texto, CNPJ_NO_TEXTO) ?? null,
    contaNegociacao: pega(texto, /PGFN-SISPAR\s*:?\s*(\d+)/) ?? null,
    competencia: periodo ? `${periodo[2]}${periodo[1]}` : null,
    vencimento: dataIso(pega(texto, /Data de Vencimento\s*:?\s*(\d{2}\/\d{2}\/\d{4})/)),
    valorCentavos: centavos(pega(texto, /Valor Total do Documento\s*:?\s*R\$\s*([\d.,]+)/)),
  };
}

export class LeitorDeGuiaDeParcelaTextoGateway implements LeitorDeGuiaDeParcelaPort {
  constructor(
    private readonly extrairTexto: (pdf: Uint8Array) => Promise<string> = extrairTextoDoPdf,
    private readonly erros: RegistroDeErrosPort = new ConsoleRegistroDeErrosGateway(),
  ) {}

  async ler(pdf: Uint8Array): Promise<LeituraDeGuia> {
    try {
      return interpretar(juntarEspacos(await this.extrairTexto(pdf)));
    } catch {
      this.erros.registrar("Leitor de guia: falha ao extrair o texto do PDF.");
      return NAO_LIDA;
    }
  }
}
