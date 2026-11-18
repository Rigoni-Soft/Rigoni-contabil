"use client";

import { useRouter } from "next/navigation";

import { LinkDeVoltar } from "@/presentation/components/atoms/link-de-voltar.component";

// "Voltar" para a tela de onde o usuário veio. Sem histórico (aba aberta direto na tela),
// cai no início, que também é o destino do link se o JS não carregar.
export function VoltarAoHistoricoContainer() {
  const router = useRouter();

  return (
    <LinkDeVoltar
      href="/"
      onClick={(evento) => {
        if (window.history.length > 1) {
          evento.preventDefault();
          router.back();
        }
      }}
    />
  );
}
