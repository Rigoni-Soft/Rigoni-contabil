"use server";

import { redirect } from "next/navigation";

import { makeLogout } from "@/main/usuarios.factory";

export async function logoutAction() {
  const logout = await makeLogout();
  await logout.execute();
  redirect("/login");
}
