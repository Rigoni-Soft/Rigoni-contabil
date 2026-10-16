"use client";

import { LinkDeAcao } from "@/presentation/components/atoms/link-de-acao.component";
import { TelaDeAvisoPage } from "@/presentation/components/pages/tela-de-aviso.page";
import { Button } from "@/presentation/components/ui/button";

// Não mostra `error.message`: no servidor ele é genérico e no cliente pode vazar detalhe interno.
export default function Error({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <TelaDeAvisoPage
      subtitulo="Algo deu errado"
      aviso="Não foi possível carregar esta tela. Tente de novo."
      rodape="Se o problema continuar, avise o suporte."
      acoes={
        <>
          <Button onClick={() => retry()}>Tentar de novo</Button>
          <LinkDeAcao href="/">Ir para o início</LinkDeAcao>
        </>
      }
    />
  );
}
