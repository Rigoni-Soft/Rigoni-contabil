import type { AcompanhamentoMensalDto } from "@/modules/rh/application/dtos/acompanhamento.dto";
import { cartoesExigidos } from "@/modules/rh/domain/services/holerite.service";
import { rotuloDaCompetencia } from "@/modules/rh/presentation/view-models/acompanhamento-mensal/acompanhamento-mensal.presenter";
import { podeGerirServicosRh } from "@/shared/kernel/papeis";
import { ROTA_RH_SERVICOS } from "@/shared/kernel/setores";

// Mesmo desenho dos cards do resumo do SN (a View de resumo lê só este shape).
type CardDoRh = {
  id: string;
  titulo: string;
  cor: "em_dia" | "atencao";
  quantidade: number;
  descricao?: string;
  mensagemVazia?: string;
  clientes: { clienteId: string; empresa: string; cnpj: string }[];
  // O acompanhamento conta sobre os clientes que têm Responsável, não sobre a carteira inteira.
  total?: number;
};

const doCliente = ({ clienteId, empresa, cnpj }: AcompanhamentoMensalDto["linhas"][number]) => ({
  clienteId,
  empresa,
  cnpj,
});

const faltando = (l: AcompanhamentoMensalDto["linhas"][number]) =>
  l.celulas.filter((c) => c.aplica && !c.concluido).map((c) => c.servicoId);

// Um card por serviço com os clientes que ainda faltam nele (aplica e não concluído), mais "Tudo
// concluído": quem não tem serviço faltando. É o que antes era a tabela; marcar fica no painel do cliente.
export function cardsDoAcompanhamento(dto: AcompanhamentoMensalDto) {
  const mes = rotuloDaCompetencia(dto.competencia);
  const total = dto.linhas.length;
  const feitos = dto.linhas.reduce((n, l) => n + l.holerite.cartoes, 0);
  const exigidos = dto.linhas.reduce((n, l) => n + cartoesExigidos(l.holerite), 0);
  const cards: CardDoRh[] = dto.servicos.map((s) => {
    const clientes = dto.linhas.filter((l) => faltando(l).includes(s.id)).map(doCliente);
    return {
      id: `servico_${s.id}`,
      titulo: `${s.nome} pendente`,
      cor: "atencao",
      quantidade: clientes.length,
      descricao:
        `Clientes que ainda não concluíram ${s.nome} em ${mes}.` +
        // O Holerite sai dos cartões: o total do setor mostra quanto falta.
        (s.sistema ? ` Cartões feitos no setor: ${feitos} de ${exigidos}.` : ""),
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

// O donut do acompanhamento: quantos clientes fecharam o mês e quantos ainda têm serviço faltando.
export function fatiasDoAcompanhamento(dto: AcompanhamentoMensalDto) {
  const completos = dto.linhas.filter((l) => faltando(l).length === 0).length;
  return [
    { id: "concluido", rotulo: "Tudo concluído", cor: "em_dia", quantidade: completos },
    {
      id: "pendente",
      rotulo: "Com pendência",
      cor: "atencao",
      quantidade: dto.linhas.length - completos,
    },
  ];
}

// O menu de configuração do Setor RH: só o Líder mantém os serviços do acompanhamento.
export const configuracoesDoRh = (papel: string, setor: string) =>
  podeGerirServicosRh(papel, setor)
    ? [{ rotulo: "Serviços do acompanhamento", href: ROTA_RH_SERVICOS }]
    : undefined;
