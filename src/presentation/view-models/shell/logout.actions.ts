"use server";

import { redirect } from "next/navigation";

import { makeLogout } from "@/main/usuarios.factory";

export async function logoutAction() {
  const logout = await makeLogout();
  const resultado = await logout.execute();

  if (!resultado.ok) {
    // Não finge logout: se a sessão pode continuar válida, não manda pro
    // /login (passaria a impressão de que saiu quando não saiu de verdade).
    console.error("Falha ao encerrar sessão:", resultado.error.message);
    redirect("/");
    return;
  }

  redirect("/login");
}
