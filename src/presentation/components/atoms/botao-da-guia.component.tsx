import { Button } from "@/presentation/components/ui/button";
import { cn } from "@/presentation/lib/utils";

type BotaoDaGuiaProps = Omit<React.ComponentProps<typeof Button>, "type" | "size"> & {
  // Outra ação em curso: o botão segue focável (aria-disabled), mas não age; quem decide o que
  // fazer com o clique é o chamador.
  ocupado?: boolean;
};

// Botão pequeno das ações de uma guia: alvo de 44 px (com mouse, área invisível `before:`) e
// aria-disabled em vez de `disabled`, para o foco não se perder durante uma ação em curso.
export function BotaoDaGuia({ ocupado, className, ...props }: BotaoDaGuiaProps) {
  return (
    <Button
      type="button"
      size="sm"
      aria-disabled={ocupado || undefined}
      className={cn(
        "relative before:absolute before:inset-x-0 before:-inset-y-1.5 aria-disabled:pointer-events-none aria-disabled:opacity-50 pointer-coarse:min-h-11 pointer-coarse:before:hidden",
        className,
      )}
      {...props}
    />
  );
}
