import "server-only";

import { makeListarUsuarios } from "@/main/usuarios.factory";

export async function carregarUsuarios() {
  const listarUsuarios = await makeListarUsuarios();
  return listarUsuarios.execute();
}
