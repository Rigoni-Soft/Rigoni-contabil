import { situacaoDosParcelamentos } from "@/modules/clientes/application/mappers/parcelamentos-do-cliente.mapper";
import type {
  CorStatusResumo,
  FatiaComparativoDto,
} from "@/modules/clientes/application/ports/in/resumo-setor.provider";
import type { ResumoOperacionalRow } from "@/modules/clientes/application/ports/out/cliente-query.provider";
import { rotuloResponsavel, SEM_RESPONSAVEL_ID } from "@/shared/kernel/papeis";

function contar(
  definicao: readonly (readonly [string, string, CorStatusResumo])[],
  ocorrencias: (string | null)[],
): FatiaComparativoDto[] {
  return definicao.map(([id, rotulo, cor]) => ({
    id,
    rotulo,
    cor,
    quantidade: ocorrencias.filter((o) => o === id).length,
  }));
}

function porResponsavel(linhas: ResumoOperacionalRow[]): FatiaComparativoDto[] {
  const grupos = new Map<string, FatiaComparativoDto>();
  for (const l of linhas) {
    const id = l.responsavelId ?? SEM_RESPONSAVEL_ID;
    const grupo = grupos.get(id) ?? {
      id,
      rotulo: rotuloResponsavel(l.responsavelId, l.responsavelNome),
      cor: l.responsavelId ? "em_dia" : "informativo",
      quantidade: 0,
    };
    if (l.dasStatus === "enviado") grupo.quantidade += 1;
    grupos.set(id, grupo);
  }
  return [...grupos.values()].sort(
    (a, b) => b.quantidade - a.quantidade || a.rotulo.localeCompare(b.rotulo),
  );
}

export function comparativoDeParcelamento(
  linhas: Pick<ResumoOperacionalRow, "parcelamentos">[],
  agora: Date,
): FatiaComparativoDto[] {
  const situacoes = linhas.map((l) => situacaoDosParcelamentos(l, agora));
  return (
    [
      ["enviado", "Enviado", "em_dia", "enviado"],
      ["pendente", "Pendente", "atencao", "pendente"],
      ["em_atraso", "Em atraso", "urgente", "pendenteEmAtraso"],
      ["interno", "Interno", "informativo", "interno"],
    ] as const
  ).map(([id, rotulo, cor, campo]) => ({
    id,
    rotulo,
    cor,
    quantidade: situacoes.filter((s) => s[campo]).length,
  }));
}

export function calcularComparativosSn(linhas: ResumoOperacionalRow[], agora: Date) {
  const atividades = linhas.flatMap((l) =>
    (["industria", "comercio", "servico"] as const).filter((a) => l.atividadeMes[a]),
  );
  return {
    das: contar(
      [
        ["enviado", "Enviada", "em_dia"],
        ["pendente", "Pendente", "urgente"],
        ["sem_movimento", "Sem movimento", "informativo"],
        ["pronto", "Pronto", "atencao"],
      ],
      linhas.map((l) => l.dasStatus),
    ),
    parcelamento: comparativoDeParcelamento(linhas, agora),
    atividade: contar(
      [
        ["industria", "Indústria", "em_dia"],
        ["comercio", "Comércio", "em_dia"],
        ["servico", "Serviço", "em_dia"],
      ],
      atividades,
    ),
    responsaveis: porResponsavel(linhas),
  };
}
