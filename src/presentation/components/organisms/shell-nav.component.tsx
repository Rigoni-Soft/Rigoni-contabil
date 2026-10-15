import Link from "next/link";

import { Caixa, Linha } from "@/presentation/components/atoms/caixa.component";
import { cn } from "@/presentation/lib/utils";
import { SETOR_LABEL } from "@/shared/kernel/setores";

type SetorNav = { slug: string };

type ShellNavProps = { setores: SetorNav[] };

// Única aba com tela de verdade por trás (#36) — as demais seguem como
// placeholder desabilitado até ganharem painel próprio.
const ROTA_POR_SETOR: Record<string, string> = {
  simples_nacional: "/simples-nacional",
};

const CHIP =
  "inline-flex items-center rounded-md border border-border px-3 py-1.5 text-sm pointer-coarse:min-h-11";

export function ShellNav({ setores }: ShellNavProps) {
  return (
    <Linha
      espaco={2}
      quebra
      como="nav"
      aria-label="Setores"
      className="border-b border-border bg-card px-4 py-3 sm:px-6"
    >
      {setores.map((setor) => {
        const rota = ROTA_POR_SETOR[setor.slug];
        const label = SETOR_LABEL[setor.slug] ?? setor.slug;
        return rota ? (
          <Link
            key={setor.slug}
            href={rota}
            className={cn(CHIP, "font-medium text-foreground hover:bg-accent")}
          >
            {label}
          </Link>
        ) : (
          <Caixa
            como="span"
            key={setor.slug}
            aria-disabled="true"
            title="Tela ainda não construída"
            className={cn(CHIP, "cursor-not-allowed text-muted-foreground")}
          >
            {label}
          </Caixa>
        );
      })}
    </Linha>
  );
}
