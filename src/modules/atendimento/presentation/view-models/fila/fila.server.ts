import "server-only";

import { makeListarFila } from "@/main/atendimento.factory";
import type { SetorSlug } from "@/shared/kernel/setores";

export async function carregarFila(setor: SetorSlug) {
  const listarFila = await makeListarFila();
  return listarFila.execute({ setor });
}
