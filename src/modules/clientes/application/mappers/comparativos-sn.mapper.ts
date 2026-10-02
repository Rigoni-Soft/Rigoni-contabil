import type { FatiaComparativoDto } from "@/modules/clientes/application/ports/in/obter-resumo-setor-sn.provider";
import type { ResumoOperacionalRow } from "@/modules/clientes/application/ports/out/cliente-query.provider";

function contar(
  definicao: readonly (readonly [string, string])[],
  ocorrencias: (string | null)[],
): FatiaComparativoDto[] {
  return definicao.map(([id, rotulo]) => ({
    id,
    rotulo,
    quantidade: ocorrencias.filter((o) => o === id).length,
  }));
}

// Gráficos da spec #24: DAS usa o status bruto (não os buckets compostos dos
// cards, que se sobrepõem); atividade do mês são 3 flags independentes.
export function calcularComparativosSn(linhas: ResumoOperacionalRow[]) {
  const atividades = linhas.flatMap((l) =>
    (["industria", "comercio", "servico"] as const).filter((a) => l.atividadeMes[a]),
  );
  return {
    das: contar(
      [
        ["enviado", "Enviada"],
        ["pendente", "Pendente"],
        ["sem_movimento", "Sem movimento"],
        ["pronto", "Pronto"],
      ],
      linhas.map((l) => l.dasStatus),
    ),
    parcelamento: contar(
      [
        ["enviado", "Enviado"],
        ["pendente", "Pendente"],
        ["interno", "Interno"],
      ],
      linhas.map((l) => (l.temParcelamento ? l.parcelamentoStatus : null)),
    ),
    atividade: contar(
      [
        ["industria", "Indústria"],
        ["comercio", "Comércio"],
        ["servico", "Serviço"],
      ],
      atividades,
    ),
  };
}
