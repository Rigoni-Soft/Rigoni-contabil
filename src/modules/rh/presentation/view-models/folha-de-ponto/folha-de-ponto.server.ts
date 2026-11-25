import "server-only";

import { makeObterFolhaDePonto } from "@/main/rh.factory";

export async function carregarFolhaDePonto(input: {
  clienteId: string;
  competencia?: string;
  empregadoId?: string;
}) {
  const obter = await makeObterFolhaDePonto();
  return obter.execute(input);
}
