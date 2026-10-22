import { Trash2 } from "lucide-react";

import { CaixaDeMarcacao } from "@/presentation/components/atoms/caixa-de-marcacao.component";
import { Linha } from "@/presentation/components/atoms/caixa.component";
import { CampoDeTexto } from "@/presentation/components/molecules/campo-de-texto.component";
import { Button } from "@/presentation/components/ui/button";

type LinhaDeContatoProps = {
  indice: number;
  // Props dos inputs (o `register`/Controller do formulário, já resolvidos por quem monta).
  nome: React.ComponentProps<"input">;
  telefone: React.ComponentProps<"input">;
  padrao: React.ComponentProps<"input">;
  erroNome?: string;
  erroTelefone?: string;
  // Sem callback (visualização): não há o que remover, o botão nem aparece.
  onRemover?: () => void;
};

// Um Contato do Cliente: nome, telefone, "Padrão" e a ação de remover. A numeração é 1-based.
export function LinhaDeContato({
  indice,
  nome,
  telefone,
  padrao,
  erroNome,
  erroTelefone,
  onRemover,
}: LinhaDeContatoProps) {
  return (
    <Linha
      alinhar="fim"
      espaco={3}
      quebra
      role="group"
      aria-label={`Contato ${indice + 1}`}
      className="rounded-md border border-border p-3"
    >
      <CampoDeTexto
        id={`contatos.${indice}.nome`}
        rotulo="Nome"
        obrigatorio
        erro={erroNome}
        className="min-w-[10rem] flex-1 gap-1"
        {...nome}
      />
      <CampoDeTexto
        id={`contatos.${indice}.telefone`}
        rotulo="Telefone"
        obrigatorio
        erro={erroTelefone}
        className="min-w-[10rem] flex-1 gap-1"
        {...telefone}
      />
      <CaixaDeMarcacao rotulo="Padrão" className="pb-2" {...padrao} />
      {onRemover && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemover}
          aria-label={`Remover contato ${indice + 1}`}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      )}
    </Linha>
  );
}
