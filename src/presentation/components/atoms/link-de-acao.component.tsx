import Link from "next/link";

import { buttonVariants } from "@/presentation/components/ui/button";
import { cn } from "@/presentation/lib/utils";

type LinkDeAcaoProps = {
  href: string;
  variant?: "default" | "destructive" | "outline" | "ghost";
  className?: string;
  // Destino fora do app (ex.: link assinado): abre em nova aba, sem `opener`.
  externo?: boolean;
  children: React.ReactNode;
};

// Navegação com a aparência de botão (o destino é uma rota, não uma ação do formulário).
export function LinkDeAcao({
  href,
  variant = "outline",
  className,
  externo,
  children,
}: LinkDeAcaoProps) {
  return (
    <Link
      href={href}
      className={cn(buttonVariants({ variant }), className)}
      {...(externo && { target: "_blank", rel: "noopener noreferrer" })}
    >
      {children}
    </Link>
  );
}
