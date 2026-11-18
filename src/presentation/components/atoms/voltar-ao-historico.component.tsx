"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

type VoltarAoHistoricoProps = { fallbackHref?: string; children?: React.ReactNode };

// "Voltar" para a tela de onde o usuário veio. Sem histórico (aba aberta direto na
// tela), cai no `fallbackHref`, que também é o destino do link se o JS não carregar.
export function VoltarAoHistorico({
  fallbackHref = "/",
  children = "Voltar",
}: VoltarAoHistoricoProps) {
  const router = useRouter();

  return (
    <Link
      href={fallbackHref}
      onClick={(evento) => {
        if (window.history.length > 1) {
          evento.preventDefault();
          router.back();
        }
      }}
      className="inline-flex min-h-6 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline pointer-coarse:min-h-11"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {children}
    </Link>
  );
}
