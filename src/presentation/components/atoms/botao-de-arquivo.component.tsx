import { buttonVariants } from "@/presentation/components/ui/button";
import { cn } from "@/presentation/lib/utils";

type BotaoDeArquivoProps = {
  id?: string;
  rotulo: string;
  rotuloAcessivel: string;
  aceitar: string;
  ocupado?: boolean;
  descritoPor?: string;
  invalido?: boolean;
  onEscolher: (arquivo: File) => void;
};

export function BotaoDeArquivo({
  id,
  rotulo,
  rotuloAcessivel,
  aceitar,
  ocupado,
  descritoPor,
  invalido,
  onEscolher,
}: BotaoDeArquivoProps) {
  return (
    <label
      className={cn(
        buttonVariants({ variant: "link", size: "sm" }),
        "relative cursor-pointer before:absolute before:inset-x-0 before:-inset-y-1.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background pointer-coarse:min-h-11 pointer-coarse:before:hidden",
        ocupado && "pointer-events-none opacity-50",
      )}
    >
      <span aria-hidden="true">{rotulo}</span>
      <input
        id={id}
        type="file"
        accept={aceitar}
        aria-disabled={ocupado || undefined}
        aria-label={rotuloAcessivel}
        aria-describedby={descritoPor}
        aria-invalid={invalido || undefined}
        className="sr-only"
        onChange={(evento) => {
          const arquivo = evento.target.files?.[0];
          evento.target.value = "";
          if (arquivo) onEscolher(arquivo);
        }}
      />
    </label>
  );
}
