import "server-only";

import { makeConsultarResponsavelDoSetor } from "@/main/clientes.factory";

// Sem tipo de retorno explícito (mesmo padrão de editar-cadastro-operacional.server.ts).
export async function carregarResponsavelDoSetor(clienteId: string) {
  const consultar = await makeConsultarResponsavelDoSetor();
  return consultar.execute(clienteId);
}
