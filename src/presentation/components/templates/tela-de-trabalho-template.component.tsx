import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/presentation/lib/utils";

// Larguras por categoria de tela (DESIGN.md → Layout): a largura é relativa, não um `max-w` fixo.
const LARGURA = {
  conta: "max-w-md",
  lista: "max-w-3xl",
  formulario: "w-[80%]",
  conteudo: "w-[90%]",
} as const;

type TelaDeTrabalhoTemplateProps = {
  header: React.ReactNode;
  // Barra de navegação por Setor (só nas telas de dashboard).
  nav?: React.ReactNode;
  largura: keyof typeof LARGURA;
  // Sem `voltarHref` não há link de volta (telas de entrada da navegação e do perfil).
  voltarHref?: string;
  voltarRotulo?: string;
  titulo?: string;
  descricao?: string;
  conteudo: React.ReactNode;
};

// Estrutura comum das telas autenticadas: cabeçalho, container centralizado, "Voltar", título e o
// conteúdo em um slot. Sempre Server.
export function TelaDeTrabalhoTemplate({
  header,
  nav,
  largura,
  voltarHref,
  voltarRotulo = "Voltar",
  titulo,
  descricao,
  conteudo,
}: TelaDeTrabalhoTemplateProps) {
  return (
    <main className="min-h-dvh bg-background">
      {header}
      {nav}
      <div className={cn("mx-auto px-4 py-8 sm:px-6", LARGURA[largura])}>
        {voltarHref && (
          <Link
            href={voltarHref}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {voltarRotulo}
          </Link>
        )}
        {titulo && (
          <h1
            className={cn(
              "text-xl font-bold tracking-tight text-primary",
              voltarHref && "mt-3",
              descricao ? "mb-2" : "mb-6",
            )}
          >
            {titulo}
          </h1>
        )}
        {descricao && <p className="mb-6 text-sm text-muted-foreground">{descricao}</p>}
        <div className={cn(voltarHref && !titulo && "mt-3")}>{conteudo}</div>
      </div>
    </main>
  );
}
