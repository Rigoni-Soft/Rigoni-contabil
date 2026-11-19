import { Check, Trash2, X } from "lucide-react";

import { Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { FieldError } from "@/presentation/components/atoms/field-error.component";
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
  // Contato já gravado na tabela: a ação é a lixeira. Sem esta marca, a linha é nova e as ações são
  // Salvar (grava só este contato) e Cancelar (volta a linha ao padrão).
  salvo?: boolean;
  salvando?: boolean;
  // Falha ao salvar esta linha (a do servidor, que não é de um campo).
  erroDaLinha?: string;
  onSalvar?: () => void;
  onCancelar?: () => void;
  // Sem callback (visualização): não há o que remover, o botão nem aparece.
  onRemover?: () => void;
  // Visualização: nada é obrigatório (não há o que preencher), então sem asterisco.
  somenteLeitura?: boolean;
};

// Um Contato do Cliente: nome, telefone, e-mail (ao menos um dos dois canais) e as ações da linha.
// A numeração é 1-based.
export function LinhaDeContato({
  indice,
  nome,
  telefone,
  email,
  erroNome,
  erroTelefone,
  erroEmail,
  salvo,
  salvando,
  erroDaLinha,
  onSalvar,
  onCancelar,
  onRemover,
  somenteLeitura,
}: LinhaDeContatoProps) {
  const numero = indice + 1;
  const acoesDeLinhaNova = !salvo && !somenteLeitura && onSalvar && onCancelar;
  return (
    <Pilha espaco={1}>
      <Linha
        alinhar="fim"
        espaco={3}
        quebra
        role="group"
        aria-label={`Contato ${numero}`}
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
        {salvo && onRemover && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemover}
            aria-label={`Remover contato ${numero}`}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        )}
        {acoesDeLinhaNova && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onSalvar}
              disabled={salvando}
              aria-label={`Salvar contato ${numero}`}
            >
              <Check className="size-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onCancelar}
              disabled={salvando}
              aria-label={`Cancelar contato ${numero}`}
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </>
        )}
      </Linha>
      {erroDaLinha && <FieldError>{erroDaLinha}</FieldError>}
    </Pilha>
  );
}
