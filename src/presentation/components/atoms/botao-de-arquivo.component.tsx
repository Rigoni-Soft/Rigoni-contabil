import { buttonVariants } from "@/presentation/components/ui/button";
import { cn } from "@/presentation/lib/utils";

type BotaoDeArquivoProps = {
  // Id do input: o foco volta a ele quando o botão da ação some (DESIGN.md, "Foco do teclado depois da ação").
  id?: string;
  rotulo: string;
  // O campo precisa dizer ao leitor de tela de qual item se trata.
  rotuloAcessivel: string;
  aceitar: string;
  // Ação em curso: o campo segue focável (aria-disabled, como os botões irmãos); quem decide o que fazer
  // com a escolha é o chamador (o hook avisa que há uma ação em andamento).
  ocupado?: boolean;
  descritoPor?: string;
  invalido?: boolean;
  onEscolher: (arquivo: File) => void;
};

// Diferente do BotaoDeAnexo de propósito: com ação em curso o campo segue focável (`aria-disabled`),
// e não `disabled`, para o foco não se perder.
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
          // Esvazia para que escolher o mesmo arquivo de novo (depois de uma recusa) dispare onChange.
          evento.target.value = "";
          if (arquivo) onEscolher(arquivo);
        }}
      />
    </label>
  );
}
