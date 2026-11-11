import Link from "next/link";

import { buttonVariants } from "@/presentation/components/ui/button";
import { cn } from "@/presentation/lib/utils";

type LinkDeAcaoProps = {
  href: string;
  variant?: "default" | "destructive" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
  className?: string;
  // Destino fora do app (ex.: link assinado): abre em nova aba, sem `opener`.
  externo?: boolean;
  // O link da seleção em tela (empregado escolhido, quinzena aberta): além da variante, o leitor de tela ouve "atual".
  atual?: boolean;
  // Nome acessível quando o texto visível sozinho é ambíguo (ex.: vários "Cartão de ponto →" numa lista).
  "aria-label"?: string;
  children: React.ReactNode;
};

// Navegação com a aparência de botão (o destino é uma rota, não uma ação do formulário).
export function LinkDeAcao({
  href,
  variant = "outline",
  size,
  className,
  externo,
  atual,
  "aria-label": rotulo,
  children,
}: LinkDeAcaoProps) {
  return (
    <Link
      href={href}
      aria-label={rotulo}
      aria-current={atual ? "true" : undefined}
      className={cn(buttonVariants({ variant, size }), className)}
      {...(externo && { target: "_blank", rel: "noopener noreferrer" })}
    >
      {children}
    </Link>
  );
}
