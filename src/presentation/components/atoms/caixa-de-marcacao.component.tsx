import { cn } from "@/presentation/lib/utils";

type CaixaDeMarcacaoProps = Omit<React.ComponentProps<"input">, "type"> & {
  rotulo: string;
  // Só para leitor de tela: a caixa sozinha numa célula de tabela, nomeada pela coluna e pela linha.
  rotuloOculto?: boolean;
  // Classes do <label> (alinhamento dentro da linha onde a caixa entra).
  className?: string;
};

// Checkbox nativo com o rótulo clicável; a cor vem do `accent-color` global (globals.css).
export function CaixaDeMarcacao({
  rotulo,
  rotuloOculto,
  className,
  ...props
}: CaixaDeMarcacaoProps) {
  return (
    <label className={cn("flex items-center gap-1.5 text-sm", className)}>
      <input type="checkbox" {...props} />
      {rotuloOculto ? <span className="sr-only">{rotulo}</span> : rotulo}
    </label>
  );
}
