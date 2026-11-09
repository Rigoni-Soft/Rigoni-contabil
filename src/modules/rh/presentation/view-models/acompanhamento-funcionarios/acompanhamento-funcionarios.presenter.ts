import type {
  AcompanhamentoFuncionariosDto,
  DetalheDoFuncionarioDto,
} from "@/modules/rh/application/dtos/acompanhamento.dto";
import { rotuloDaCompetencia } from "@/modules/rh/presentation/view-models/acompanhamento-mensal/acompanhamento-mensal.presenter";

// Sem cliente atribuído não há o que fechar: 0%.
export const percentual = (pontos: number, atribuidos: number) =>
  atribuidos === 0 ? 0 : Math.round((pontos / atribuidos) * 100);

export function funcionariosDoGrafico(dto: AcompanhamentoFuncionariosDto, rota: string) {
  return dto.funcionarios.map((f) => ({
    ...f,
    percentual: percentual(f.pontos, f.atribuidos),
    href: `${rota}/${f.id}?mes=${dto.competencia}`,
    // A célula abre a lista das empresas que faltam naquele serviço para este funcionário.
    faltam: f.faltam.map((c) => ({
      ...c,
      href: `${rota}/${encodeURIComponent(f.id)}/${encodeURIComponent(c.servicoId)}?mes=${dto.competencia}`,
    })),
  }));
}

// Os clientes sem Responsável abrem o cadastro operacional; o "Voltar" de lá traz de volta para a lista.
export function semResponsavelDoGrafico(dto: AcompanhamentoFuncionariosDto, rota: string) {
  return dto.semResponsavel.map((c) => ({
    ...c,
    href: `/clientes/${encodeURIComponent(c.clienteId)}?voltarPara=${encodeURIComponent(rota)}`,
  }));
}

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
