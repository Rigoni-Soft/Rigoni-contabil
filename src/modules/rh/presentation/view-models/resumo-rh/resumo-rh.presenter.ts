import type { AcompanhamentoMensalDto } from "@/modules/rh/application/dtos/acompanhamento.dto";
import { rotuloDaCompetencia } from "@/modules/rh/presentation/view-models/acompanhamento-mensal/acompanhamento-mensal.presenter";
import { podeGerirServicosRh } from "@/shared/kernel/papeis";
import { ROTA_RH_SERVICOS } from "@/shared/kernel/setores";

type CardDoRh = {
  id: string;
  titulo: string;
  cor: "em_dia" | "atencao";
  quantidade: number;
  descricao?: string;
  mensagemVazia?: string;
  clientes: { clienteId: string; empresa: string; cnpj: string }[];
  total?: number;
};

const doCliente = ({ clienteId, empresa, cnpj }: AcompanhamentoMensalDto["linhas"][number]) => ({
  clienteId,
  empresa,
  cnpj,
});

const faltando = (l: AcompanhamentoMensalDto["linhas"][number]) =>
  l.celulas.filter((c) => c.aplica && !c.concluido).map((c) => c.servicoId);

export function cardsDoAcompanhamento(dto: AcompanhamentoMensalDto) {
  const mes = rotuloDaCompetencia(dto.competencia);
  const total = dto.linhas.length;
  const totalDeCartoes = () => {
    const feitos = dto.linhas.reduce((n, l) => n + l.holerite.cartoes, 0);
    const exigidos = dto.linhas.reduce((n, l) => n + l.holerite.exigidos, 0);
    return ` Cartões feitos no setor: ${feitos} de ${exigidos}.`;
  };
  const cards: CardDoRh[] = dto.servicos.map((s) => {
    const clientes = dto.linhas.filter((l) => faltando(l).includes(s.id)).map(doCliente);
    return {
      id: `servico_${s.id}`,
      titulo: `${s.nome} pendente`,
      cor: "atencao",
      quantidade: clientes.length,
      descricao:
        `Clientes que ainda não concluíram ${s.nome} em ${mes}.` +
        (s.sistema ? totalDeCartoes() : ""),
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

export const configuracoesDoRh = (papel: string, setor: string) =>
  podeGerirServicosRh(papel, setor)
    ? [{ rotulo: "Serviços do acompanhamento", href: ROTA_RH_SERVICOS }]
    : undefined;
