import "server-only";

import { redirect } from "next/navigation";

import { makeListarSetores, makeObterSessao } from "@/main/usuarios.factory";

// Sem tipo de retorno explícito: nomear o DTO do módulo usuarios aqui violaria
// "presentation global não importa módulos" (Anexo A). O shape flui por inferência.
export async function carregarSessao() {
  const obterSessao = await makeObterSessao();
  return obterSessao.execute();
}

// Guard das páginas autenticadas: sem sessão vai pro login; com senha provisória, o fluxo
// obrigatório de troca tem prioridade. Para páginas que carregam a sessão em paralelo com outros
// dados: `validarSessao(sessao)`; nas demais, `exigirSessao()`.
export function validarSessao<T extends { precisaTrocarSenha: boolean }>(
  sessao: T | null | undefined,
): T {
  if (!sessao) redirect("/login");
  if (sessao.precisaTrocarSenha) redirect("/trocar-senha");
  return sessao;
}

export async function exigirSessao() {
  return validarSessao(await carregarSessao());
}

// Já filtrado por RBAC no caso de uso (Admin vê tudo, Líder/Funcionário só o
// próprio setor) — a navegação não decide autorização, só exibe o que recebe.
export async function carregarSetoresDaNavegacao() {
  const listarSetores = await makeListarSetores();
  return listarSetores.execute();
}
