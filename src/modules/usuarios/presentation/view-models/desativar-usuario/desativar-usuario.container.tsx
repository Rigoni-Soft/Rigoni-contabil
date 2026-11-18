"use client";

import { DesativarUsuario } from "@/presentation/components/organisms/desativar-usuario.component";

import { useDesativarUsuario } from "./use-desativar-usuario.hook";

export function DesativarUsuarioContainer({
  usuarioId,
  nome,
  desativacaoPendente,
}: {
  usuarioId: string;
  nome: string;
  desativacaoPendente?: boolean;
}) {
  return (
    <DesativarUsuario
      nome={nome}
      desativacaoPendente={desativacaoPendente}
      {...useDesativarUsuario(usuarioId)}
    />
  );
}
