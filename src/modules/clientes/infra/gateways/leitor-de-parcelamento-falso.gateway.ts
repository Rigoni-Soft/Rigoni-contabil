import type {
  LeitorDeParcelamentoPort,
  LeituraDeParcelamento,
} from "@/modules/clientes/application/ports/out/leitor-de-parcelamento.provider";

const MARCADOR_DE_FALHA = "[leitor:falha]";
const MARCADOR_SEM_CODIGO = "[leitor:sem-codigo]";
const MARCADOR_DE_CNPJ_DE_OUTRA_EMPRESA = "[leitor:cnpj-outro]";
const CNPJ_DE_OUTRA_EMPRESA = "10.690.529/0001-38";
const CODIGO_FALSO = "FALSO-123456";
const PARCELAS_DO_PGFN_FALSO = 12;
const PARCELAS_DA_RECEITA_FALSA = 7;
const VALOR_DA_PARCELA_FALSA_CENTAVOS = 31620;
const DATA_DE_ADESAO_FALSA = "2026-08-27";

export class LeitorDeParcelamentoFalsoGateway implements LeitorDeParcelamentoPort {
  async ler(pdf: Uint8Array): Promise<LeituraDeParcelamento> {
    const texto = Buffer.from(pdf).toString("latin1");
    if (texto.includes(MARCADOR_DE_FALHA)) return { lido: false, motivo: "ilegivel" };
    const semCodigo = texto.includes(MARCADOR_SEM_CODIGO);
    const parcelas = semCodigo ? PARCELAS_DA_RECEITA_FALSA : PARCELAS_DO_PGFN_FALSO;
    return {
      lido: true,
      codigo: semCodigo ? null : CODIGO_FALSO,
      quantidadeDeParcelas: parcelas,
      cnpj: texto.includes(MARCADOR_DE_CNPJ_DE_OUTRA_EMPRESA) ? CNPJ_DE_OUTRA_EMPRESA : null,
      origem: semCodigo ? "receita_federal" : "pgfn",
      totalDeParcelas: parcelas,
      valorDaParcelaCentavos: VALOR_DA_PARCELA_FALSA_CENTAVOS,
      dataDeAdesao: DATA_DE_ADESAO_FALSA,
    };
  }
}
