"use client";

import { useActionState } from "react";

import { LogoutButton } from "@/presentation/components/organisms/logout-button.component";

import { logoutAction } from "./logout.actions";

export function LogoutButtonContainer() {
  const [estado, formAction, pendente] = useActionState(logoutAction, null);

  return <LogoutButton formAction={formAction} pendente={pendente} erro={estado?.erro} />;
}
