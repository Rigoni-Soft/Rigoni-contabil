import Link from "next/link";

import { Caixa, Linha } from "@/presentation/components/atoms/caixa.component";
import { cn } from "@/presentation/lib/utils";
import { SETOR_LABEL } from "@/shared/kernel/setores";

type SetorNav = { slug: string };

// `rotaAtual`: a aba da tela aberta ganha o destaque cheio (e `aria-current`); em "/" nenhuma está
// selecionada, e as que têm tela são só links comuns.
type ShellNavProps = { setores: SetorNav[]; rotaAtual?: string };

// Única aba com tela de verdade por trás — as demais seguem como
// placeholder desabilitado até ganharem painel próprio.
const ROTA_POR_SETOR: Record<string, string> = {
  simples_nacional: "/simples-nacional",
};

const CHIP =
  "inline-flex items-center rounded-md border border-border px-3 py-1.5 text-sm pointer-coarse:min-h-11";

export function ShellNav({ setores, rotaAtual }: ShellNavProps) {
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
            aria-current={rota === rotaAtual ? "page" : undefined}
            className={cn(
              CHIP,
              rota === rotaAtual
                ? "border-primary bg-primary font-medium text-primary-foreground"
                : "text-foreground hover:bg-accent",
            )}
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
      {/* Aba de todo login, ao lado das de Setor: leva à Fila (antes um botão só do Admin). */}
      <Link
        href="/atendimento"
        aria-current={rotaAtual === "/atendimento" ? "page" : undefined}
        className={cn(
          CHIP,
          "font-medium",
          rotaAtual === "/atendimento"
            ? "border-primary bg-primary text-primary-foreground"
            : "text-foreground hover:bg-accent",
        )}
      >
        Atendimento
      </Link>
    </Linha>
  );
}
