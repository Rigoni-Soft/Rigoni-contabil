import Link from "next/link";
import { KeyRound } from "lucide-react";

import { ThemeToggle } from "@/presentation/components/ui/theme-toggle";

type ShellHeaderProps = {
  nome: string;
  papel: string;
  setor: string;
  sair: React.ReactNode;
};

const PAPEL_LABEL: Record<string, string> = {
  admin: "Admin",
  lider_setor: "Líder de setor",
  funcionario: "Funcionário",
};

export function ShellHeader({ nome, papel, setor, sair }: ShellHeaderProps) {
  const escopo = papel === "admin" ? "acesso a todos os setores" : `Setor: ${setor}`;
  const inicial = nome.charAt(0).toUpperCase();

  return (
    <header className="flex items-center justify-between gap-4 border-b border-border bg-card px-4 py-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
        >
          {inicial}
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{nome}</p>
          <p className="truncate text-sm text-muted-foreground">
            {PAPEL_LABEL[papel] ?? papel} · {escopo}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {/* Único caminho de navegação até /trocar-senha fora do redirecionamento
            obrigatório de senha provisória — sem isso a troca voluntária só era
            alcançável digitando a URL direto (achado da revisão manual em 28/09/2026). */}
        <Link
          href="/trocar-senha"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"
        >
          <KeyRound aria-hidden="true" />
          Trocar senha
        </Link>
        <ThemeToggle />
        {sair}
      </div>
    </header>
  );
}
