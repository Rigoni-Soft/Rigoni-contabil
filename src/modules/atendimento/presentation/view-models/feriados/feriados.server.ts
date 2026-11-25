import "server-only";

import { makeListarFeriados } from "@/main/atendimento.factory";

export async function carregarFeriados() {
  const listarFeriados = await makeListarFeriados();
  return listarFeriados.execute();
}
