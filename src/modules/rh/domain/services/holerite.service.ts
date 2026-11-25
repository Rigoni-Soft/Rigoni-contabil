export type ContagemDoHolerite = { cadastrados: number; semMovimento: number; cartoes: number };

type ClienteComHolerite = {
  naoAplica: string[];
  concluidos: string[];
  holerite: ContagemDoHolerite;
};

export const cartoesExigidos = (c: ContagemDoHolerite) => c.cadastrados - c.semMovimento;

export function situacaoDoHolerite(c: ContagemDoHolerite): "nao_aplica" | "concluido" | "pendente" {
  const exigidos = cartoesExigidos(c);
  if (exigidos <= 0) return "nao_aplica";
  return c.cartoes >= exigidos ? "concluido" : "pendente";
}

export function comHolerite<C extends ClienteComHolerite>(
  clientes: C[],
  servicos: { id: string; sistema: boolean }[],
): C[] {
  const id = servicos.find((s) => s.sistema)?.id;
  if (!id) return clientes;
  return clientes.map((c) => {
    const situacao = situacaoDoHolerite(c.holerite);
    const semHolerite = (ids: string[]) => ids.filter((x) => x !== id);
    return {
      ...c,
      naoAplica: [...semHolerite(c.naoAplica), ...(situacao === "nao_aplica" ? [id] : [])],
      concluidos: [...semHolerite(c.concluidos), ...(situacao === "concluido" ? [id] : [])],
    };
  });
}
