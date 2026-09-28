import Link from "next/link";
import { KeyRound, UserPlus } from "lucide-react";

import { buttonVariants } from "@/presentation/components/ui/button";
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

// Quem cada papel cadastra (#30/#32) — Funcionário não cadastra ninguém, por
// isso não entra neste mapa (o link de cadastro simplesmente não aparece pra ele).
const CADASTRAR_LABEL: Record<string, string> = {
  admin: "Cadastrar Líder",
  lider_setor: "Cadastrar Funcionário",
};

export function ShellHeader({ nome, papel, setor, sair }: ShellHeaderProps) {
  const escopo = papel === "admin" ? "acesso a todos os setores" : `Setor: ${setor}`;
  const inicial = nome.charAt(0).toUpperCase();
  const rotuloCadastrar = CADASTRAR_LABEL[papel];

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
        {/* Único caminho de navegação até /admin/usuarios/novo — Admin e Líder
            cadastram (escopado por papel no próprio caso de uso, #30/#32);
            Funcionário não cadastra ninguém, então não vê o link. */}
        {rotuloCadastrar && (
          <Link
            href="/admin/usuarios/novo"
            aria-label={rotuloCadastrar}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            <UserPlus aria-hidden="true" />
            <span className="hidden sm:inline">{rotuloCadastrar}</span>
          </Link>
        )}
        {/* Único caminho de navegação até /trocar-senha fora do redirecionamento
            obrigatório de senha provisória — sem isso a troca voluntária só era
            alcançável digitando a URL direto (achado da revisão manual em 28/09/2026). */}
        <Link
          href="/trocar-senha"
          aria-label="Trocar senha"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <KeyRound aria-hidden="true" />
          <span className="hidden sm:inline">Trocar senha</span>
        </Link>
        <ThemeToggle />
        {sair}
      </div>
    </header>
  );
}
