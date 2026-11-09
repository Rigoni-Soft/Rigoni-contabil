import type { DetalheDoFuncionarioDto } from "@/modules/rh/application/dtos/acompanhamento.dto";
import { rotuloDaCompetencia } from "@/modules/rh/presentation/view-models/acompanhamento-mensal/acompanhamento-mensal.presenter";

// Sem cliente atribuído não há o que fechar: 0%.
export const percentual = (pontos: number, atribuidos: number) =>
  atribuidos === 0 ? 0 : Math.round((pontos / atribuidos) * 100);

export function propsDoDetalhe(detalhe: DetalheDoFuncionarioDto, competencia: string) {
  const { funcionario } = detalhe;
  return {
    nome: funcionario.nome,
    rotuloMes: rotuloDaCompetencia(competencia),
    pontos: funcionario.pontos,
    atribuidos: funcionario.atribuidos,
    percentual: percentual(funcionario.pontos, funcionario.atribuidos),
    pendencias: detalhe.pendencias,
    evolucao: detalhe.evolucao.map((m) => ({
      competencia: m.competencia,
      rotulo: rotuloDaCompetencia(m.competencia),
      percentual: percentual(m.pontos, m.atribuidos),
    })),
    maisAtrasados: detalhe.maisAtrasados,
  };
}
