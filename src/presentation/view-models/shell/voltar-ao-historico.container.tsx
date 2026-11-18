"use client";

import { useRouter } from "next/navigation";

import { LinkDeVoltar } from "@/presentation/components/atoms/link-de-voltar.component";

// "Voltar" para a tela de onde o usuário veio. Só volta no histórico quando veio de outra tela do próprio
// sistema (referrer da mesma origem): quem chega por favorito ou link externo segue o link para o início,
// que também é o destino se o JS não carregar. Ctrl/Cmd/Shift/Alt-clique e botão do meio ficam com o navegador.
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
