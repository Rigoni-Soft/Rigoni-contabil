import "server-only";

import { makeListarMeusAtendimentos } from "@/main/atendimento.factory";

export async function carregarMeusAtendimentos() {
  const listarMeusAtendimentos = await makeListarMeusAtendimentos();
  return listarMeusAtendimentos.execute();
}
