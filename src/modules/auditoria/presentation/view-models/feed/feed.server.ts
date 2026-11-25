import "server-only";

import { makeListarRegistros } from "@/main/auditoria.factory";

export async function carregarFeedAuditoria() {
  const listarRegistros = await makeListarRegistros();
  return listarRegistros.execute();
}
