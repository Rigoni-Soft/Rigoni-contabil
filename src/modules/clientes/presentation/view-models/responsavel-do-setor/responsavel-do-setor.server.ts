import "server-only";

import { makeConsultarResponsavelDoSetor } from "@/main/clientes.factory";

export async function carregarResponsavelDoSetor(clienteId: string) {
  const consultar = await makeConsultarResponsavelDoSetor();
  return consultar.execute(clienteId);
}
