import { Pilha } from "@/presentation/components/atoms/caixa.component";
import { FieldError } from "@/presentation/components/atoms/field-error.component";
import { RequiredMark } from "@/presentation/components/atoms/required-mark.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";
import { descricaoDoCampo } from "@/presentation/lib/descricao-do-campo";

type CampoDeTextoProps = React.ComponentProps<"input"> & {
  id: string;
  rotulo: string;
  obrigatorio?: boolean;
  erro?: string;
  // Aviso que não é erro de validação (ex.: consulta pública sem confirmação): só aparece sem erro.
  aviso?: string;
  // Dica fixa sob o campo (formato, de onde vem a sugestão); ligada ao campo por aria-describedby.
  ajuda?: string;
  // Classes do contêiner (espaçamento entre rótulo e campo muda por tela).
  className?: string;
};

// Rótulo visível + campo + erro. O `aria-invalid` e o `aria-required` saem de `erro` e `obrigatorio`.
export function CampoDeTexto({
  id,
  rotulo,
  obrigatorio,
  erro,
  aviso,
  ajuda,
  className,
  ...props
}: CampoDeTextoProps) {
  return (
    <Pilha espaco="campo" className={className}>
      <Label htmlFor={id}>
        {rotulo}
        {obrigatorio && <RequiredMark />}
      </Label>
      <Input
        id={id}
        aria-required={obrigatorio ? "true" : undefined}
        aria-invalid={!!erro}
        {...props}
        aria-describedby={descricaoDoCampo(
          props["aria-describedby"],
          ajuda && `${id}-ajuda`,
          (erro || aviso) && `${id}-mensagem`,
        )}
      />
      {ajuda && (
        <Texto variante="nota" id={`${id}-ajuda`}>
          {ajuda}
        </Texto>
      )}
      {erro && <FieldError id={`${id}-mensagem`}>{erro}</FieldError>}
      {!erro && aviso && <FieldError id={`${id}-mensagem`}>{aviso}</FieldError>}
    </Pilha>
  );
}
