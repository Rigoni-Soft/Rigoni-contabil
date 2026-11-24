import type {
  LeitorDeGuiaDeParcelaPort,
  LeituraDeGuia,
} from "@/modules/clientes/application/ports/out/leitor-de-guia-de-parcela.provider";

const MARCADOR_DE_FALHA = "[leitor:falha]";
const MARCADOR_DE_CNPJ_DE_OUTRA_EMPRESA = "[leitor:cnpj-outro]";
const CNPJ_DE_OUTRA_EMPRESA = "10.690.529/0001-38";
const MARCADOR_DE_GUIA = /\[leitor:guia=([^;\]]*);([^;\]]*);([^;\]]*)\]/;

const SEM_DADOS = {
  lido: true as const,
  cnpj: null,
  contaNegociacao: null,
  competencia: null,
  vencimento: null,
  valorCentavos: null,
};

export class LeitorDeGuiaDeParcelaFalsoGateway implements LeitorDeGuiaDeParcelaPort {
  async ler(pdf: Uint8Array): Promise<LeituraDeGuia> {
    const texto = Buffer.from(pdf).toString("latin1");
    if (texto.includes(MARCADOR_DE_FALHA)) return { lido: false };
    if (texto.includes(MARCADOR_DE_CNPJ_DE_OUTRA_EMPRESA)) {
      return { ...SEM_DADOS, cnpj: CNPJ_DE_OUTRA_EMPRESA };
    }
    const guia = MARCADOR_DE_GUIA.exec(texto);
    if (!guia) return SEM_DADOS;
    return { ...SEM_DADOS, cnpj: guia[1], contaNegociacao: guia[2], competencia: guia[3] };
  }
}
