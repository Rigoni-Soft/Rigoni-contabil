import Link from "next/link";

import { buttonVariants } from "@/presentation/components/ui/button";
import { cn } from "@/presentation/lib/utils";

type LinkDeAcaoProps = {
  href: string;
  variant?: "default" | "destructive" | "outline" | "ghost";
  className?: string;
  // Destino fora do app (ex.: link assinado): abre em nova aba, sem `opener`.
  externo?: boolean;
  // O link da seleção em tela (empregado escolhido, quinzena aberta): além da variante, o leitor de tela ouve "atual".
  atual?: boolean;
  children: React.ReactNode;
};

// Navegação com a aparência de botão (o destino é uma rota, não uma ação do formulário).
export function LinkDeAcao({
  href,
  variant = "outline",
  className,
  externo,
  atual,
  children,
}: LinkDeAcaoProps) {
  return (
    <Link
      href={href}
      aria-current={atual ? "true" : undefined}
      className={cn(buttonVariants({ variant }), className)}
      {...(externo && { target: "_blank", rel: "noopener noreferrer" })}
    >
      {children}
    </Link>
  );
}
