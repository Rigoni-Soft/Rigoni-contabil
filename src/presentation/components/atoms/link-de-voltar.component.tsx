import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type LinkDeVoltarProps = { href: string; children?: React.ReactNode };

export function LinkDeVoltar({ href, children = "Voltar" }: LinkDeVoltarProps) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-6 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline pointer-coarse:min-h-11"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {children}
    </Link>
  );
}
