"use client";

import { DesativarUsuario } from "@/presentation/components/organisms/desativar-usuario.component";

import { useDesativarUsuario } from "./use-desativar-usuario.hook";

export function DesativarUsuarioContainer({
  usuarioId,
  nome,
}: {
  usuarioId: string;
  nome: string;
}) {
  return <DesativarUsuario nome={nome} {...useDesativarUsuario(usuarioId)} />;
}
