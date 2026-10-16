"use server";

import { redirect } from "next/navigation";

import { makeLogout } from "@/main/usuarios.factory";

export type LogoutState = { erro: string } | null;

// Assinatura (estado, FormData) por causa do useActionState em LogoutButton: falha de encerramento
// precisa de um estado pra interface mostrar aviso visível, não só logar e redirecionar às cegas.
export async function logoutAction(
  _estadoAnterior: LogoutState,
  _formData: FormData,
): Promise<LogoutState> {
  const logout = await makeLogout();
  const resultado = await logout.execute();

  if (!resultado.ok) {
    // Não finge logout: se a sessão pode continuar válida, não manda pro
    // /login (passaria a impressão de que saiu quando não saiu de verdade).
    console.error("Falha ao encerrar sessão:", resultado.error.message);
    return { erro: "Não foi possível sair. Tente novamente." };
  }

  redirect("/login");
}
