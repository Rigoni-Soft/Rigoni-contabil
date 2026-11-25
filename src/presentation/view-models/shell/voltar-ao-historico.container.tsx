"use client";

import { useRouter } from "next/navigation";

import { LinkDeVoltar } from "@/presentation/components/atoms/link-de-voltar.component";

type CliqueDeLink = Pick<MouseEvent, "metaKey" | "ctrlKey" | "shiftKey" | "altKey" | "button">;

const cliqueComModificador = (clique: CliqueDeLink) =>
  clique.metaKey || clique.ctrlKey || clique.shiftKey || clique.altKey || clique.button !== 0;

const veioDeOutraTelaDoSistema = () =>
  document.referrer.startsWith(`${window.location.origin}/`) && window.history.length > 1;

export function VoltarAoHistoricoContainer() {
  const router = useRouter();

  return (
    <LinkDeVoltar
      href="/"
      onClick={(evento) => {
        if (cliqueComModificador(evento) || !veioDeOutraTelaDoSistema()) return;
        evento.preventDefault();
        router.back();
      }}
    />
  );
}
