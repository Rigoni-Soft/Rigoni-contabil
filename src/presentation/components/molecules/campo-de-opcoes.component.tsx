import { Pilha } from "@/presentation/components/atoms/caixa.component";
import { FieldError } from "@/presentation/components/atoms/field-error.component";
import { Opcao } from "@/presentation/components/atoms/opcao.component";
import { RequiredMark } from "@/presentation/components/atoms/required-mark.component";
import { Label } from "@/presentation/components/ui/label";
import { Select } from "@/presentation/components/ui/select";
import { descricaoDoCampo } from "@/presentation/lib/descricao-do-campo";

type CampoDeOpcoesProps = React.ComponentProps<"select"> & {
  id: string;
  rotulo: string;
  opcoes: readonly { valor: string; rotulo: string }[];
  obrigatorio?: boolean;
  // Primeira opção, de valor "". Desabilitada quando a escolha é obrigatória ("Selecione").
  placeholder?: string;
  placeholderDesabilitado?: boolean;
  erro?: string;
  aviso?: string;
  // Classes do contêiner e do <select> (campo travado mantém a cor plena, por exemplo).
  className?: string;
  classeDoSelect?: string;
};

// Rótulo visível + select de opções + erro, sobre o `Select` do ui/.
export function CampoDeOpcoes({
  id,
  rotulo,
  opcoes,
  obrigatorio,
  placeholder,
  placeholderDesabilitado,
  erro,
  aviso,
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
      {erro && <FieldError id={`${id}-mensagem`}>{erro}</FieldError>}
      {!erro && aviso && <FieldError id={`${id}-mensagem`}>{aviso}</FieldError>}
    </Pilha>
  );
}
