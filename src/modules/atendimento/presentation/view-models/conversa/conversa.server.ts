import "server-only";

import { makeObterConversa } from "@/main/atendimento.factory";

// Sem tipo de retorno explícito (mesmo padrão de feed.server.ts): o shape flui por inferência.
export async function carregarConversa(atendimentoId: string) {
  const obterConversa = await makeObterConversa();
  return obterConversa.execute({ atendimentoId });
}
