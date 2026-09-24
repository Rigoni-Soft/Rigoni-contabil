import "server-only";

import { makeObterSessao } from "@/main/usuarios.factory";

// Sem tipo de retorno explícito: nomear o DTO do módulo usuarios aqui violaria
// "presentation global não importa módulos" (Anexo A). O shape flui por inferência.
export async function carregarSessao() {
  const obterSessao = await makeObterSessao();
  return obterSessao.execute();
}
