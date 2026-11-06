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
  // Único ponto da regra de alternância Líder <-> Funcionário.
  const papelAlvo = papel === "lider_setor" ? "funcionario" : "lider_setor";
  return (
    <AlterarPapel nome={nome} papelAlvo={papelAlvo} {...useAlterarPapel(usuarioId, papelAlvo)} />
  );
}
