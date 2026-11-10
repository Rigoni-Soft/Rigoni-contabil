import "server-only";

import { makeObterAcompanhamentoMensal } from "@/main/rh.factory";

export async function carregarAcompanhamentoMensal(competencia?: string) {
  const obter = await makeObterAcompanhamentoMensal();
  return obter.execute({ competencia });
}
