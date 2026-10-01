import "server-only";

import { makeObterResumoSetorSn } from "@/main/clientes.factory";

// Mesmo padrão de feed.server.ts/shell.server.ts: sem tipo de retorno
// explícito, o shape flui por inferência (presentation não importa
// application/infra, arquitetura.md §3.4).
export async function carregarResumoSetorSn() {
  const obter = await makeObterResumoSetorSn();
  return obter.execute();
}
