import "server-only";

import { makeObterResumoSetorRh } from "@/main/clientes.factory";

export async function carregarResumoSetorRh() {
  const obter = await makeObterResumoSetorRh();
  return obter.execute();
}
