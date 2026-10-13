import Link from "next/link";

type ChipDeSetorProps = {
  // Sem `href` o chip fica desabilitado: o Setor ainda não tem tela própria.
  href?: string;
  children: React.ReactNode;
};

export function ChipDeSetor({ href, children }: ChipDeSetorProps) {
  if (href) {
    return (
      <Link
        href={href}
        className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
      >
        {children}
      </Link>
    );
  }
  return (
    <span
      aria-disabled="true"
      title="Tela ainda não construída"
      className="cursor-not-allowed rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground"
    >
      {children}
    </span>
  );
}
