import Link from "next/link";

import { SETOR_LABEL } from "@/shared/kernel/setores";

type SetorNav = { slug: string };

type ShellNavProps = { setores: SetorNav[] };

// Única aba com tela de verdade por trás (#36) — as demais seguem como
// placeholder desabilitado até ganharem painel próprio.
const ROTA_POR_SETOR: Record<string, string> = {
  simples_nacional: "/simples-nacional",
};

export function ShellNav({ setores }: ShellNavProps) {
  return (
    <nav
      aria-label="Setores"
      className="flex flex-wrap gap-2 border-b border-border bg-card px-4 py-3 sm:px-6"
    >
      {setores.map((setor) => {
        const rota = ROTA_POR_SETOR[setor.slug];
        const label = SETOR_LABEL[setor.slug] ?? setor.slug;
        if (rota) {
          return (
            <Link
              key={setor.slug}
              href={rota}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
            >
              {label}
            </Link>
          );
        }
        return (
          <span
            key={setor.slug}
            aria-disabled="true"
            title="Tela ainda não construída"
            className="cursor-not-allowed rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground"
          >
            {label}
          </span>
        );
      })}
    </nav>
  );
}
