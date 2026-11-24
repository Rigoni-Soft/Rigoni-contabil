"use client";

import { useRouter } from "next/navigation";

import { LinkDeVoltar } from "@/presentation/components/atoms/link-de-voltar.component";

export function VoltarAoHistoricoContainer() {
  const router = useRouter();

  return (
    <LinkDeVoltar
      href="/"
      onClick={(evento) => {
        const comModificador =
          evento.metaKey ||
          evento.ctrlKey ||
          evento.shiftKey ||
          evento.altKey ||
          evento.button !== 0;
        const veioDoSistema = document.referrer.startsWith(`${window.location.origin}/`);
        if (comModificador || !veioDoSistema || window.history.length <= 1) return;
        evento.preventDefault();
        router.back();
      }}
    />
  );
}
