import type {
  LeitorDeGuiaDeParcelaPort,
  LeituraDeGuia,
} from "@/modules/clientes/application/ports/out/leitor-de-guia-de-parcela.provider";

const SEM_DADOS = {
  lido: true as const,
  cnpj: null,
  contaNegociacao: null,
  competencia: null,
  vencimento: null,
  valorCentavos: null,
};

// Adapter falso e determinístico (padrão em dev, CI e Preview; nenhum teste depende do conteúdo do
// PDF). Os marcadores no texto escolhem o cenário: `[leitor:falha]` não lê, `[leitor:cnpj-outro]`
// lê o CNPJ de outra empresa, `[leitor:guia=<cnpj>;<conta>;<AAAAMM>]` lê exatamente esses três
// (para a guia nascer confirmada); sem marcador, lê sem nada conferível e a guia fica a confirmar.
export class LeitorDeGuiaDeParcelaFalsoGateway implements LeitorDeGuiaDeParcelaPort {
  async ler(pdf: Uint8Array): Promise<LeituraDeGuia> {
    const texto = Buffer.from(pdf).toString("latin1");
    if (texto.includes("[leitor:falha]")) return { lido: false };
    if (texto.includes("[leitor:cnpj-outro]")) return { ...SEM_DADOS, cnpj: "10.690.529/0001-38" };
    const guia = /\[leitor:guia=([^;\]]*);([^;\]]*);([^;\]]*)\]/.exec(texto);
    if (!guia) return SEM_DADOS;
    return { ...SEM_DADOS, cnpj: guia[1], contaNegociacao: guia[2], competencia: guia[3] };
  }
}
