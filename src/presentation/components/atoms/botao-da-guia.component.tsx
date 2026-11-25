import { Button } from "@/presentation/components/ui/button";
import { BOTAO_OCUPADO } from "@/presentation/lib/botao-ocupado";
import { cn } from "@/presentation/lib/utils";

type BotaoDaGuiaProps = Omit<React.ComponentProps<typeof Button>, "type" | "size"> & {
  ocupado?: boolean;
};

export function BotaoDaGuia({ ocupado, className, ...props }: BotaoDaGuiaProps) {
  return (
    <Button
      type="button"
      size="sm"
      aria-disabled={ocupado || undefined}
      className={cn(
        BOTAO_OCUPADO,
        "relative before:absolute before:inset-x-0 before:-inset-y-1.5 pointer-coarse:min-h-11 pointer-coarse:before:hidden",
        className,
      )}
      {...props}
    />
  );
}
