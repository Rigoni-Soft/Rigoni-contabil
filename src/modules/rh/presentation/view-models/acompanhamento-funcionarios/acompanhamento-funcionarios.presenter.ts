import type {
  AcompanhamentoFuncionariosDto,
  DetalheDoFuncionarioDto,
} from "@/modules/rh/application/dtos/acompanhamento.dto";
import { rotuloDaCompetencia } from "@/modules/rh/presentation/view-models/acompanhamento-mensal/acompanhamento-mensal.presenter";
import { mesVizinho } from "@/shared/kernel/mes-atual";

// Sem cliente atribuído não há o que fechar: 0%.
export const percentual = (pontos: number, atribuidos: number) =>
  atribuidos === 0 ? 0 : Math.round((pontos / atribuidos) * 100);

export function funcionariosDoGrafico(dto: AcompanhamentoFuncionariosDto, rota: string) {
  return dto.funcionarios.map((f) => ({
    ...f,
    percentual: percentual(f.pontos, f.atribuidos),
    href: `${rota}/${encodeURIComponent(f.id)}?mes=${dto.competencia}`,
    // A célula abre a lista das empresas que faltam naquele serviço para este funcionário.
    faltam: f.faltam.map((c) => ({
      ...c,
      href: `${rota}/${encodeURIComponent(f.id)}/${encodeURIComponent(c.servicoId)}?mes=${dto.competencia}`,
    })),
  }));
}

// Mês anterior e próximo da lista dos funcionários; o próximo some no mês corrente (`atual`).
export function linksDoMesDosFuncionarios(rota: string, competencia: string, atual: string) {
  const href = (delta: number) => `${rota}?mes=${mesVizinho(competencia, delta)}`;
  return { anteriorHref: href(-1), proximoHref: competencia < atual ? href(1) : undefined };
}

// A lista das empresas de um Funcionário que faltam num serviço: o título e se o serviço existe para ele.
export function tituloDaListaDeFalta(
  dto: AcompanhamentoFuncionariosDto,
  funcionarioId: string,
  servicoId: string,
) {
  const funcionario = dto.funcionarios.find((f) => f.id === funcionarioId);
  const servico = funcionario?.faltam.find((c) => c.servicoId === servicoId);
  return servico && funcionario ? `${servico.nome} pendente: ${funcionario.nome}` : undefined;
}

// Cada Cliente das listas abre o cadastro operacional; o "Voltar" de lá traz de volta para `voltarPara`.
const hrefDoCliente = (clienteId: string, voltarPara: string) =>
  `/clientes/${encodeURIComponent(clienteId)}?voltarPara=${encodeURIComponent(voltarPara)}`;

export function semResponsavelDoGrafico(dto: AcompanhamentoFuncionariosDto, rota: string) {
  return dto.semResponsavel.map((c) => ({ ...c, href: hrefDoCliente(c.clienteId, rota) }));
}

export function propsDoDetalhe(
  detalhe: DetalheDoFuncionarioDto,
  competencia: string,
  voltarPara: string,
) {
  const comLink = <C extends { clienteId: string }>(c: C) => ({
    ...c,
    href: hrefDoCliente(c.clienteId, voltarPara),
  });
  const { funcionario } = detalhe;
  return {
    nome: funcionario.nome,
    rotuloMes: rotuloDaCompetencia(competencia),
    pontos: funcionario.pontos,
    atribuidos: funcionario.atribuidos,
    percentual: percentual(funcionario.pontos, funcionario.atribuidos),
    pendencias: detalhe.pendencias.map((p) => ({ ...p, clientes: p.clientes.map(comLink) })),
    evolucao: detalhe.evolucao.map((m) => ({
      competencia: m.competencia,
      rotulo: rotuloDaCompetencia(m.competencia),
      percentual: percentual(m.pontos, m.atribuidos),
    })),
    maisAtrasados: detalhe.maisAtrasados.map(comLink),
  };
}
