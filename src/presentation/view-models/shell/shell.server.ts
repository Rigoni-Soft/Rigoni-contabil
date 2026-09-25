import "server-only";

import { makeListarSetores, makeObterSessao } from "@/main/usuarios.factory";

// Sem tipo de retorno explícito: nomear o DTO do módulo usuarios aqui violaria
// "presentation global não importa módulos" (Anexo A). O shape flui por inferência.
export async function carregarSessao() {
  const obterSessao = await makeObterSessao();
  return obterSessao.execute();
}

// Já filtrado por RBAC no caso de uso (Admin vê tudo, Líder/Funcionário só o
// próprio setor) — a navegação não decide autorização, só exibe o que recebe.
export async function carregarSetoresDaNavegacao() {
  const listarSetores = await makeListarSetores();
  return listarSetores.execute();
}
