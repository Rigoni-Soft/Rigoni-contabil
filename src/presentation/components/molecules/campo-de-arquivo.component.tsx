import { Pilha } from "@/presentation/components/atoms/caixa.component";
import { FieldError } from "@/presentation/components/atoms/field-error.component";
import { FileInput } from "@/presentation/components/atoms/file-input.component";
import { Label } from "@/presentation/components/ui/label";
import { descricaoDoCampo } from "@/presentation/lib/descricao-do-campo";

type CampoDeArquivoProps = React.ComponentProps<typeof FileInput> & {
  rotulo: string;
  erro?: string;
};

// Rótulo visível + seletor de arquivo + erro. O `aria-invalid` sai de `erro`.
export function CampoDeArquivo({ id, rotulo, erro, ...props }: CampoDeArquivoProps) {
  return (
    <Pilha espaco="campo">
      <Label htmlFor={id}>{rotulo}</Label>
      <FileInput
        id={id}
        aria-invalid={!!erro}
        {...props}
        aria-describedby={descricaoDoCampo(props["aria-describedby"], erro && `${id}-mensagem`)}
      />
      {erro && <FieldError id={`${id}-mensagem`}>{erro}</FieldError>}
    </Pilha>
  );
}
