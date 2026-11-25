import "server-only";

import { makeObterResumoSetorSn } from "@/main/clientes.factory";

export async function carregarResumoSetorSn() {
  const obter = await makeObterResumoSetorSn();
  return obter.execute();
}
