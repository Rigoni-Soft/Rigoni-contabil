import Link from "next/link";

type SetorNav = { slug: string };

type ShellNavProps = { setores: SetorNav[] };

// Record<string, ...> solto (não Record<SetorSlug, ...>) de propósito: `setor.slug`
// vem de um Output DTO (string crua), então indexar com SetorSlug exigiria um cast
// no ponto de leitura sem ganho real — a exaustividade já é garantida no validador
// de domínio (shared/kernel/setores.ts), não precisa duplicar aqui.
const SETOR_LABEL: Record<string, string> = {
  rh: "RH",
  tributario: "Tributário",
  simples_nacional: "Simples Nacional",
  contabil: "Contábil",
  societario: "Societário",
  condominios: "Condomínios",
  financeiro: "Financeiro",
  administrativo: "Administrativo",
  recepcao: "Recepção",
};

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
