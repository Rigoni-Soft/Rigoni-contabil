import "server-only";

import { makeListarFeriados } from "@/main/atendimento.factory";

// Sem tipo de retorno explícito (mesmo padrão de feed.server.ts): o shape flui por inferência.
export async function carregarFeriados() {
  const listarFeriados = await makeListarFeriados();
  return listarFeriados.execute();
}
