import type { FatiaComparativoDto } from "@/modules/clientes/application/ports/in/obter-resumo-setor-sn.provider";
import type { ResumoOperacionalRow } from "@/modules/clientes/application/ports/out/cliente-query.provider";
import { rotuloResponsavel, SEM_RESPONSAVEL_ID } from "@/shared/kernel/papeis";

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

// Um grupo por Responsável presente nos Clientes (mais "Sem responsável" quando
// existe algum Cliente sem atribuição), contando os com DAS enviada.
function porResponsavel(linhas: ResumoOperacionalRow[]): FatiaComparativoDto[] {
  const grupos = new Map<string, FatiaComparativoDto>();
  for (const l of linhas) {
    const id = l.responsavelId ?? SEM_RESPONSAVEL_ID;
    const grupo = grupos.get(id) ?? {
      id,
      rotulo: rotuloResponsavel(l.responsavelId, l.responsavelNome),
      quantidade: 0,
    };
    if (l.dasStatus === "enviado") grupo.quantidade += 1;
    grupos.set(id, grupo);
  }
  return [...grupos.values()].sort(
    (a, b) => b.quantidade - a.quantidade || a.rotulo.localeCompare(b.rotulo),
  );
}

// Gráficos: DAS usa o status bruto (não os buckets compostos dos cards, que se
// sobrepõem); atividade do mês são 3 flags independentes.
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
    responsaveis: porResponsavel(linhas),
  };
}
