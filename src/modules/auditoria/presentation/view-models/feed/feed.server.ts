import "server-only";

import { makeListarRegistros } from "@/main/auditoria.factory";

// Sem tipo de retorno explícito (mesmo padrão de shell.server.ts): nomear o Result/DTO
// do módulo aqui violaria "presentation não importa domain/infra". O shape flui por inferência.
export async function carregarFeedAuditoria() {
  const listarRegistros = await makeListarRegistros();
  return listarRegistros.execute();
}
