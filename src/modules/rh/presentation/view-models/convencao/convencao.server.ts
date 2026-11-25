import "server-only";

import { makeObterConvencoesDoCliente } from "@/main/rh.factory";

export async function carregarConvencoes(clienteId: string) {
  const obter = await makeObterConvencoesDoCliente();
  return obter.execute({ clienteId });
}
