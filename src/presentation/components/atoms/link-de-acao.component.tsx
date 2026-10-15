import Link from "next/link";

import { buttonVariants } from "@/presentation/components/ui/button";
import { cn } from "@/presentation/lib/utils";

type LinkDeAcaoProps = {
  href: string;
  variant?: "default" | "destructive" | "outline" | "ghost";
  className?: string;
  children: React.ReactNode;
};

// Navegação com a aparência de botão (o destino é uma rota, não uma ação do formulário).
export function LinkDeAcao({ href, variant = "outline", className, children }: LinkDeAcaoProps) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant }), className)}>
      {children}
    </Link>
  );
}
