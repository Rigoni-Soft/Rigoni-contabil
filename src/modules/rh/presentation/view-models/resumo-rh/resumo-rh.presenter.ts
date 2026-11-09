import type {
  AcompanhamentoFuncionariosDto,
  AcompanhamentoMensalDto,
} from "@/modules/rh/application/dtos/acompanhamento.dto";
import { rotuloDaCompetencia } from "@/modules/rh/presentation/view-models/acompanhamento-mensal/acompanhamento-mensal.presenter";

// Mesmo desenho dos cards do resumo do SN (a View de resumo lê só este shape).
export type CardDoRh = {
  id: string;
  titulo: string;
  cor: "em_dia" | "atencao";
  quantidade: number;
  descricao?: string;
  mensagemVazia?: string;
  clientes: { clienteId: string; empresa: string; cnpj: string }[];
  // Cards de funcionário: abrem o acompanhamento dele e contam sobre os clientes dele.
  href?: string;
  total?: number;
};

export type GrupoDoRh = { titulo: string; cardIds: string[] };

const doCliente = ({ clienteId, empresa, cnpj }: AcompanhamentoMensalDto["linhas"][number]) => ({
  clienteId,
  empresa,
  cnpj,
});

// Um card por serviço com os clientes que ainda faltam nele (aplica e não concluído), mais "Tudo
// concluído": quem não tem serviço faltando. É o que antes era a tabela; marcar fica no painel do cliente.
export function cardsDoAcompanhamento(dto: AcompanhamentoMensalDto) {
  const mes = rotuloDaCompetencia(dto.competencia);
  const total = dto.linhas.length;
  const faltando = (l: AcompanhamentoMensalDto["linhas"][number]) =>
    l.celulas.filter((c) => c.aplica && !c.concluido).map((c) => c.servicoId);

  const cards: CardDoRh[] = dto.servicos.map((s) => {
    const clientes = dto.linhas.filter((l) => faltando(l).includes(s.id)).map(doCliente);
    return {
      id: `servico_${s.id}`,
      titulo: `${s.nome} pendente`,
      cor: "atencao",
      quantidade: clientes.length,
      descricao: `Clientes que ainda não concluíram ${s.nome} em ${mes}.`,
      mensagemVazia: `Nenhum cliente com ${s.nome} pendente em ${mes}.`,
      clientes,
      total,
    };
  });
  const completos = dto.linhas.filter((l) => faltando(l).length === 0).map(doCliente);
  cards.push({
    id: "servicos_concluidos",
    titulo: "Tudo concluído",
    cor: "em_dia",
    quantidade: completos.length,
    descricao: `Clientes sem nenhum serviço faltando em ${mes}.`,
    mensagemVazia: `Nenhum cliente com todos os serviços concluídos em ${mes}.`,
    clientes: completos,
    total,
  });
  return { cards, grupo: { titulo: `Acompanhamento de ${mes}`, cardIds: cards.map((c) => c.id) } };
}

// Um card por Funcionário do RH: pontos sobre clientes atribuídos; clicar abre o acompanhamento dele.
export function cardsDosFuncionarios(dto: AcompanhamentoFuncionariosDto, rotaDosFuncionarios: string) {
  const cards: CardDoRh[] = dto.funcionarios.map((f) => ({
    id: `funcionario_${f.id}`,
    titulo: f.nome,
    cor: f.atribuidos > 0 && f.pontos === f.atribuidos ? "em_dia" : "atencao",
    quantidade: f.pontos,
    clientes: [],
    href: `${rotaDosFuncionarios}/${encodeURIComponent(f.id)}?mes=${dto.competencia}`,
    total: f.atribuidos,
  }));
  return { cards, grupo: { titulo: "Acompanhamento dos funcionários", cardIds: cards.map((c) => c.id) } };
}
