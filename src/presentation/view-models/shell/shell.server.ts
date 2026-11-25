import "server-only";

import { redirect } from "next/navigation";

import { makeListarSetores, makeObterSessao } from "@/main/usuarios.factory";

export async function carregarSessao() {
  const obterSessao = await makeObterSessao();
  return obterSessao.execute();
}

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

export async function carregarSetoresDaNavegacao() {
  const listarSetores = await makeListarSetores();
  return listarSetores.execute();
}
