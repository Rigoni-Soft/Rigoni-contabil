import "server-only";

import { makeObterResumoSetorRh } from "@/main/clientes.factory";

// Mesmo padrão de resumo-setor-sn.server.ts: o shape flui por inferência.
export async function carregarResumoSetorRh() {
  const obter = await makeObterResumoSetorRh();
  return obter.execute();
}
