import "server-only";

import { makeListarMeusAtendimentos } from "@/main/atendimento.factory";

// Sem tipo de retorno explícito (mesmo padrão de fila.server.ts): o shape flui por inferência.
export async function carregarMeusAtendimentos() {
  const listarMeusAtendimentos = await makeListarMeusAtendimentos();
  return listarMeusAtendimentos.execute();
}
