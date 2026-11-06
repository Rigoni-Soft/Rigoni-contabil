import "server-only";

import { makeListarUsuarios } from "@/main/usuarios.factory";

// Sem tipo de retorno explícito (mesmo padrão de feed.server.ts).
export async function carregarUsuarios() {
  const listarUsuarios = await makeListarUsuarios();
  return listarUsuarios.execute();
}
