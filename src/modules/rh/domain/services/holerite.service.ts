// Empregados ativos do Cliente, os "sem movimento" do mês e os que têm o Cartão de ponto do mês feito (ver `situacao-do-cartao`).
export type ContagemDoHolerite = { cadastrados: number; semMovimento: number; cartoes: number };

// Cartões que o mês exige: os empregados ativos, menos os "sem movimento".
export const cartoesExigidos = (c: ContagemDoHolerite) => c.cadastrados - c.semMovimento;

// Cliente sem empregados (ou só com "sem movimento") não tem Holerite a cumprir; senão, concluído quando
// todo cartão exigido está salvo.
export function situacaoDoHolerite(c: ContagemDoHolerite): "nao_aplica" | "concluido" | "pendente" {
  const exigidos = cartoesExigidos(c);
  if (exigidos <= 0) return "nao_aplica";
  return c.cartoes >= exigidos ? "concluido" : "pendente";
}
