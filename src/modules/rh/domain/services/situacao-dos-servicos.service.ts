import {
  situacaoDoHolerite,
  type ContagemDoHolerite,
} from "@/modules/rh/domain/services/holerite.service";

// Situação dos Serviços do Cliente no mês: a única definição de "aplicável", "concluído", "pendente" e "ponto".
// Dashboard, pontos, detalhe do Funcionário e painel do Cliente leem daqui; o adapter só entrega os fatos
// crus (o que foi dispensado, o que foi marcado, a contagem do Holerite). A regra do Total pago entra aqui.

// O que o adapter leu do Cliente no mês.
export type FatosDoCliente = {
  // Serviços "não se aplica" (no mês ou sempre) e concluídos à mão, por id.
  naoAplica: readonly string[];
  // Dentre os `naoAplica`, os que nunca se aplicam a este Cliente.
  naoAplicaSempre: readonly string[];
  concluidos: readonly string[];
  holerite: ContagemDoHolerite;
};

export type ServicoDoMes = { id: string; sistema: boolean };

// Por que o Serviço aplicável ainda não está concluído: falta marcar (Serviço à mão) ou faltam cartões
// (Holerite, o Serviço do sistema).
export type MotivoDoPendente = "nao_marcado" | "cartoes_faltando";

export type ServicoDoClienteNoMes = {
  servicoId: string;
  aplicavel: boolean;
  // Só com `aplicavel` falso: não se aplica em mês nenhum.
  sempre: boolean;
  concluido: boolean;
  pendente: boolean;
  motivoDoPendente?: MotivoDoPendente;
};

export type SituacaoDosServicos = {
  // Um item por Serviço, na ordem recebida.
  servicos: ServicoDoClienteNoMes[];
  // O Cliente rende ponto ao Responsável: nenhum Serviço aplicável faltando.
  ponto: boolean;
};

export function situacaoDosServicos(
  servicos: readonly ServicoDoMes[],
  fatos: FatosDoCliente,
): SituacaoDosServicos {
  const naoAplica = new Set(fatos.naoAplica);
  const sempre = new Set(fatos.naoAplicaSempre);
  const concluidos = new Set(fatos.concluidos);
  const holerite = situacaoDoHolerite(fatos.holerite);

  const itens = servicos.map((s): ServicoDoClienteNoMes => {
    // O Holerite nunca é marcado à mão: sai dos cartões, e o que o adapter trouxe dele não vale.
    const aplicavel = s.sistema ? holerite !== "nao_aplica" : !naoAplica.has(s.id);
    const concluido = s.sistema ? holerite === "concluido" : concluidos.has(s.id);
    const pendente = aplicavel && !concluido;
    return {
      servicoId: s.id,
      aplicavel,
      sempre: !aplicavel && sempre.has(s.id),
      concluido,
      pendente,
      motivoDoPendente: pendente ? (s.sistema ? "cartoes_faltando" : "nao_marcado") : undefined,
    };
  });
  return { servicos: itens, ponto: itens.every((i) => !i.pendente) };
}
