"use client";

import { DesativarUsuario } from "@/presentation/components/organisms/desativar-usuario.component";

import { useDesativarUsuario } from "./use-desativar-usuario.hook";

export function DesativarUsuarioContainer({
  usuarioId,
  nome,
  bloqueioPendente,
}: {
  usuarioId: string;
  nome: string;
  bloqueioPendente?: boolean;
}) {
  return (
    <DesativarUsuario
      nome={nome}
      bloqueioPendente={bloqueioPendente}
      {...useDesativarUsuario(usuarioId)}
    />
  );
}
