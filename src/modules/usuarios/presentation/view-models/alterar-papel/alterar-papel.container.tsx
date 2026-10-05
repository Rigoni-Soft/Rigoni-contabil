"use client";

import { AlterarPapel } from "@/presentation/components/organisms/alterar-papel.component";

import { useAlterarPapel } from "./use-alterar-papel.hook";

export function AlterarPapelContainer({
  usuarioId,
  nome,
  papel,
}: {
  usuarioId: string;
  nome: string;
  papel: string;
}) {
  return <AlterarPapel nome={nome} papel={papel} {...useAlterarPapel(usuarioId, papel)} />;
}
