"use client";

import { AlterarPapel } from "@/presentation/components/organisms/alterar-papel.component";
import type { PapelAlteravel } from "@/modules/usuarios/application/ports/out/alteracao-papel.provider";

import { useAlterarPapel } from "./use-alterar-papel.hook";

function papelOposto(papel: string): PapelAlteravel {
  return papel === "lider_setor" ? "funcionario" : "lider_setor";
}

export function AlterarPapelContainer({
  usuarioId,
  nome,
  papel,
}: {
  usuarioId: string;
  nome: string;
  papel: string;
}) {
  const papelAlvo = papelOposto(papel);
  return (
    <AlterarPapel nome={nome} papelAlvo={papelAlvo} {...useAlterarPapel(usuarioId, papelAlvo)} />
  );
}
