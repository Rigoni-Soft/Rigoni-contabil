import { Pilha } from "@/presentation/components/atoms/caixa.component";
import { FieldError } from "@/presentation/components/atoms/field-error.component";
import { Opcao } from "@/presentation/components/atoms/opcao.component";
import { RequiredMark } from "@/presentation/components/atoms/required-mark.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { Label } from "@/presentation/components/ui/label";
import { Select } from "@/presentation/components/ui/select";
import { descricaoDoCampo } from "@/presentation/lib/descricao-do-campo";

type CampoDeOpcoesProps = React.ComponentProps<"select"> & {
  id: string;
  rotulo: string;
  opcoes: readonly { valor: string; rotulo: string }[];
  obrigatorio?: boolean;
  placeholder?: string;
  placeholderDesabilitado?: boolean;
  erro?: string;
  aviso?: string;
  ajuda?: string;
  className?: string;
  classeDoSelect?: string;
};

export function CampoDeOpcoes({
  id,
  rotulo,
  opcoes,
  obrigatorio,
  placeholder,
  placeholderDesabilitado,
  erro,
  aviso,
  ajuda,
  className,
  classeDoSelect,
  ...props
}: CampoDeOpcoesProps) {
  return (
    <Pilha espaco="campo" className={className}>
      <Label htmlFor={id}>
        {rotulo}
        {obrigatorio && <RequiredMark />}
      </Label>
      <Select
        id={id}
        aria-required={obrigatorio ? "true" : undefined}
        aria-invalid={!!erro}
        className={classeDoSelect}
        {...props}
        aria-describedby={descricaoDoCampo(
          props["aria-describedby"],
          ajuda && `${id}-ajuda`,
          (erro || aviso) && `${id}-mensagem`,
        )}
      >
        {placeholder !== undefined && (
          <Opcao value="" disabled={placeholderDesabilitado}>
            {placeholder}
          </Opcao>
        )}
        {opcoes.map((opcao) => (
          <Opcao key={opcao.valor} value={opcao.valor}>
            {opcao.rotulo}
          </Opcao>
        ))}
      </Select>
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
