// Situação do Cartão de ponto de um empregado num mês, e a regra única de "cartão feito": ao menos um dia com
// apontamento (batida, Extra ou Abono). Dia salvo sem apontamento não conta. A marca "iniciado" (o Responsável
// salvou o cartão, mesmo vazio) só serve à regra de falta: não faz o cartão ser feito.
// O banco conta com a mesma regra em `rh_cartoes_do_mes` (migration 20261116120000); quem muda uma muda a outra.

export type DiaComApontamento = {
  batidas: readonly unknown[];
  extra: unknown | null;
  abono: boolean;
};

// O dia tem algo apontado: batida, Extra ou Abono.
export function diaTemApontamento(dia: DiaComApontamento): boolean {
  return dia.batidas.length > 0 || dia.extra !== null || dia.abono;
}

export type SituacaoDoCartao = "desligado" | "sem_movimento" | "feito" | "iniciado" | "por_fazer";

type EntradaDaSituacao = {
  ativo: boolean;
  semMovimento: boolean;
  iniciado: boolean;
  dias: readonly DiaComApontamento[];
};

// Desligado e "sem movimento" vencem tudo: não há cartão a cumprir. Com apontamento o cartão é feito; só
// iniciado (sem apontamento) segue por fazer, mas com a falta já valendo; senão, por fazer.
export function situacaoDoCartao(e: EntradaDaSituacao): SituacaoDoCartao {
  if (!e.ativo) return "desligado";
  if (e.semMovimento) return "sem_movimento";
  if (e.dias.some(diaTemApontamento)) return "feito";
  return e.iniciado ? "iniciado" : "por_fazer";
}

// Conta no Holerite e no PDF-resumo.
export const cartaoFeito = (situacao: SituacaoDoCartao) => situacao === "feito";
