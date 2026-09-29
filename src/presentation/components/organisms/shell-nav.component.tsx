type SetorNav = { slug: string };

type ShellNavProps = { setores: SetorNav[] };

const SETOR_LABEL: Record<string, string> = {
  rh: "RH",
  tributario: "Tributário",
  simples_nacional: "Simples Nacional",
  contabil: "Contábil",
  societario: "Societário",
  condominios: "Condomínios",
  financeiro: "Financeiro",
  administrativo: "Administrativo",
  contabil_externo: "Contábil Externo",
  ti: "T.I.",
  recepcao: "Recepção",
};

export function ShellNav({ setores }: ShellNavProps) {
  return (
    <nav
      aria-label="Setores"
      className="flex flex-wrap gap-2 border-b border-border bg-card px-4 py-3 sm:px-6"
    >
      {setores.map((setor) => (
        <span
          key={setor.slug}
          aria-disabled="true"
          title="Tela ainda não construída"
          className="cursor-not-allowed rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground"
        >
          {SETOR_LABEL[setor.slug] ?? setor.slug}
        </span>
      ))}
    </nav>
  );
}
