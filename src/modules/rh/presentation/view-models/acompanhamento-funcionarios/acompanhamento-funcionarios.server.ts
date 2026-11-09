import "server-only";

import { makeObterAcompanhamentoFuncionarios } from "@/main/rh.factory";

export async function carregarAcompanhamentoFuncionarios(
  competencia?: string,
  funcionarioId?: string,
) {
  const obter = await makeObterAcompanhamentoFuncionarios();
  return obter.execute({ competencia, funcionarioId });
}
