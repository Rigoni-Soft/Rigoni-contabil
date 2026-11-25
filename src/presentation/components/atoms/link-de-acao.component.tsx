import Link from "next/link";
import type { VariantProps } from "class-variance-authority";

import { buttonVariants } from "@/presentation/components/ui/button";
import { cn } from "@/presentation/lib/utils";

type LinkDeAcaoProps = {
  href: string;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  className?: string;
  externo?: boolean;
  atual?: boolean;
  "aria-label"?: string;
  children: React.ReactNode;
};

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
