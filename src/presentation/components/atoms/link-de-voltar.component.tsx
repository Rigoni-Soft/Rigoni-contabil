import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type LinkDeVoltarProps = {
  href: string;
  children?: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
};

export function LinkDeVoltar({ href, children = "Voltar", onClick }: LinkDeVoltarProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="inline-flex min-h-6 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline pointer-coarse:min-h-11"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {children}
    </Link>
  );
}
