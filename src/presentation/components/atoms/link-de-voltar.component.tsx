import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type LinkDeVoltarProps = { href: string; children?: React.ReactNode };

export function LinkDeVoltar({ href, children = "Voltar" }: LinkDeVoltarProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {children}
    </Link>
  );
}
