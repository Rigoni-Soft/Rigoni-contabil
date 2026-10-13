import { Caixa } from "@/presentation/components/atoms/caixa.component";
import { FieldError } from "@/presentation/components/atoms/field-error.component";
import { RequiredMark } from "@/presentation/components/atoms/required-mark.component";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";
import { cn } from "@/presentation/lib/utils";

type CampoDeTextoProps = React.ComponentProps<"input"> & {
  id: string;
  rotulo: string;
  obrigatorio?: boolean;
  erro?: string;
  // Aviso que não é erro de validação (ex.: consulta pública sem confirmação): só aparece sem erro.
  aviso?: string;
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
  className,
  ...props
}: CampoDeTextoProps) {
  return (
    <Caixa className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>
        {rotulo}
        {obrigatorio && <RequiredMark />}
      </Label>
      <Input
        id={id}
        aria-required={obrigatorio ? "true" : undefined}
        aria-invalid={!!erro}
        {...props}
      />
      {erro && <FieldError>{erro}</FieldError>}
      {!erro && aviso && <FieldError>{aviso}</FieldError>}
    </Caixa>
  );
}
