// Empregados ativos do Cliente, os "sem movimento" do mês e os que têm o Cartão de ponto do mês salvo.
export type ContagemDoHolerite = { cadastrados: number; semMovimento: number; cartoes: number };

type ClienteComHolerite = {
  naoAplica: string[];
  concluidos: string[];
  holerite: ContagemDoHolerite;
};

// Cartões que o mês exige: os empregados ativos, menos os "sem movimento".
export const cartoesExigidos = (c: ContagemDoHolerite) => c.cadastrados - c.semMovimento;

// Cliente sem empregados (ou só com "sem movimento") não tem Holerite a cumprir; senão, concluído quando
// todo cartão exigido está salvo.
export function situacaoDoHolerite(c: ContagemDoHolerite): "nao_aplica" | "concluido" | "pendente" {
  const exigidos = cartoesExigidos(c);
  if (exigidos <= 0) return "nao_aplica";
  return c.cartoes >= exigidos ? "concluido" : "pendente";
}

// O Holerite é o Serviço do sistema: nunca marcado à mão, sai dos cartões. Reescreve só a coluna dele, e
// tudo o que lê `naoAplica` e `concluidos` (pontos, pendências, tabela) passa a considerá-lo.
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
