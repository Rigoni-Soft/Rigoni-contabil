import { buttonVariants } from "@/presentation/components/ui/button";
import { cn } from "@/presentation/lib/utils";

type BotaoDeArquivoProps = {
  // Texto visível do botão.
  rotulo: string;
  // O que o leitor de tela ouve (o campo precisa dizer de qual item se trata).
  rotuloAcessivel: string;
  // Tipos que o seletor do sistema oferece (`accept`).
  aceitar: string;
  // Ação em curso: o campo segue focável (aria-disabled, como os botões irmãos); quem decide o que fazer
  // com a escolha é o chamador (o hook avisa que há uma ação em andamento).
  ocupado?: boolean;
  onEscolher: (arquivo: File) => void;
};

// Botão discreto que abre o seletor de arquivos: o <label> carrega a aparência do botão e o input
// fica sr-only (mesmo padrão do BotaoDeAnexo e do FileInput), então há um só controle focável.
export function BotaoDeArquivo({
  rotulo,
  rotuloAcessivel,
  aceitar,
  ocupado,
  onEscolher,
}: BotaoDeArquivoProps) {
  return (
    <label
      className={cn(
        buttonVariants({ variant: "link", size: "sm" }),
        "cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background pointer-coarse:min-h-11",
        ocupado && "pointer-events-none opacity-50",
      )}
    >
      <span aria-hidden="true">{rotulo}</span>
      <input
        type="file"
        accept={aceitar}
        aria-disabled={ocupado || undefined}
        aria-label={rotuloAcessivel}
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
