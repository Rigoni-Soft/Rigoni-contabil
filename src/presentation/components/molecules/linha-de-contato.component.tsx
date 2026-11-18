import { Trash2 } from "lucide-react";

import { Linha } from "@/presentation/components/atoms/caixa.component";
import { CampoDeTexto } from "@/presentation/components/molecules/campo-de-texto.component";
import { Button } from "@/presentation/components/ui/button";

type LinhaDeContatoProps = {
  indice: number;
  // Props dos inputs (o `register`/Controller do formulário, já resolvidos por quem monta).
  nome: React.ComponentProps<"input">;
  telefone: React.ComponentProps<"input">;
  email: React.ComponentProps<"input">;
  erroNome?: string;
  erroTelefone?: string;
  erroEmail?: string;
  // Sem callback (visualização): não há o que remover, o botão nem aparece.
  onRemover?: () => void;
  // Visualização: nada é obrigatório (não há o que preencher), então sem asterisco.
  somenteLeitura?: boolean;
};

// Um Contato do Cliente: nome, telefone, e-mail (ao menos um dos dois canais) e a ação de remover. A numeração é 1-based.
export function LinhaDeContato({
  indice,
  nome,
  telefone,
  email,
  erroNome,
  erroTelefone,
  erroEmail,
  onRemover,
  somenteLeitura,
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
        obrigatorio={!somenteLeitura}
        erro={erroNome}
        className="min-w-[10rem] flex-1 gap-1"
        {...nome}
      />
      <CampoDeTexto
        id={`contatos.${indice}.telefone`}
        rotulo="Telefone"
        inputMode="tel"
        ajuda={somenteLeitura ? undefined : "Ao menos um: WhatsApp ou e-mail"}
        erro={erroTelefone}
        className="min-w-[10rem] flex-1 gap-1"
        {...telefone}
      />
      <CampoDeTexto
        id={`contatos.${indice}.email`}
        rotulo="E-mail"
        type="email"
        inputMode="email"
        // A falta dos dois canais é erro da linha: o E-mail também fica inválido e aponta a mensagem.
        aria-invalid={erroTelefone || erroEmail ? true : undefined}
        aria-describedby={erroTelefone ? `contatos.${indice}.telefone-mensagem` : undefined}
        erro={erroEmail}
        className="min-w-[10rem] flex-1 gap-1"
        {...email}
      />
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
