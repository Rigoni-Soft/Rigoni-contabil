import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginPage } from "@/presentation/components/pages/login.page";
import { carregarSessao } from "@/presentation/view-models/shell/shell.server";
import { LoginContainer } from "@/modules/usuarios/presentation/view-models/login/login.container";

export const metadata: Metadata = { title: "Entrar" };

export default async function Page() {
  const sessao = await carregarSessao();
  if (sessao) redirect(sessao.precisaTrocarSenha ? "/trocar-senha" : "/");

  return <LoginPage formulario={<LoginContainer />} />;
}
