import "server-only";

import { makeListarFila } from "@/main/atendimento.factory";
import type { SetorSlug } from "@/shared/kernel/setores";

// Sem tipo de retorno explícito (mesmo padrão de conversa.server.ts): o shape flui por inferência.
export async function carregarFila(setor: SetorSlug) {
  const listarFila = await makeListarFila();
  return listarFila.execute({ setor });
}
