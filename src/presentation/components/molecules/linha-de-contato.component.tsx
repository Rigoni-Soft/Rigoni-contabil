import { Check, LoaderCircle, Trash2, X } from "lucide-react";

import { Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { FieldError } from "@/presentation/components/atoms/field-error.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { CampoDeTexto } from "@/presentation/components/molecules/campo-de-texto.component";
import { Button } from "@/presentation/components/ui/button";
import { Label } from "@/presentation/components/ui/label";

type LinhaDeContatoProps = {
  indice: number;
  // Props dos inputs (o `register`/Controller do formulário, já resolvidos por quem monta).
  nome: React.ComponentProps<"input">;
  telefone: React.ComponentProps<"input">;
  email: React.ComponentProps<"input">;
  erroNome?: string;
  erroTelefone?: string;
  erroEmail?: string;
  // Contato já gravado: a ação é a lixeira. Sem a marca, a linha é nova: Salvar e Limpar.
  salvo?: boolean;
  salvando?: boolean;
  // Falha do servidor ao salvar esta linha (não é de um campo).
  erroDaLinha?: string;
  onSalvar?: () => void;
  onLimpar?: () => void;
  // Sem callback (visualização): o botão nem aparece.
  onRemover?: () => void;
  // Visualização: nada é obrigatório, então sem asterisco.
  somenteLeitura?: boolean;
  // Contato de outro Setor: os campos ficam só de leitura (o texto diz de quem é) e a linha não tem ação.
  doutroSetor?: string;
};

// Ocupado, o botão fica `aria-disabled` e não `disabled`: o navegador não solta o foco dele.
const OCUPADO = "aria-disabled:pointer-events-none aria-disabled:opacity-50";

// Botões na altura do input: o espaçador invisível ocupa o lugar do rótulo, e a mensagem de erro
// sob o campo não os empurra.
function AcoesDaLinha({ children }: { children: React.ReactNode }) {
  return (
    <Pilha espaco="campo">
      <Label aria-hidden="true" className="invisible">
        &nbsp;
      </Label>
      <Linha alinhar="centro" espaco={1} className="h-9 pointer-coarse:h-11">
        {children}
      </Linha>
    </Pilha>
  );
}

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
  onLimpar,
  onRemover,
  somenteLeitura: somenteLeituraDaTela,
  doutroSetor,
}: LinhaDeContatoProps) {
  const numero = indice + 1;
  const somenteLeitura = somenteLeituraDaTela || Boolean(doutroSetor);
  // `readOnly` e não `disabled`: o valor segue no formulário e volta intacto ao salvar o cadastro.
  const travado = doutroSetor ? { readOnly: true } : {};
  const acoesDeLinhaNova = !salvo && !somenteLeitura && onSalvar && onLimpar;
  const idDoErroDaLinha = `contatos.${indice}.linha-mensagem`;
  const rotuloSalvar = `Salvar contato ${numero}`;
  const rotuloLimpar = `Limpar contato ${numero}`;
  const rotuloRemover = `Remover contato ${numero}`;
  return (
    <Pilha espaco={1}>
      <Linha
        alinhar="inicio"
        espaco={3}
        quebra
        role="group"
        aria-label={`Contato ${numero}`}
        aria-describedby={erroDaLinha ? idDoErroDaLinha : undefined}
        className="rounded-md border border-border p-3"
      >
        <CampoDeTexto
          id={`contatos.${indice}.nome`}
          rotulo="Nome"
          obrigatorio={!somenteLeitura}
          erro={erroNome}
          className="min-w-[10rem] flex-1 gap-1"
          {...nome}
          {...travado}
        />
        <CampoDeTexto
          id={`contatos.${indice}.telefone`}
          rotulo="WhatsApp"
          inputMode="tel"
          erro={erroTelefone}
          className="min-w-[10rem] flex-1 gap-1"
          {...telefone}
          {...travado}
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
          {...travado}
        />
        {salvo && onRemover && !doutroSetor && (
          <AcoesDaLinha>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onRemover}
              aria-label={rotuloRemover}
              title={rotuloRemover}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          </AcoesDaLinha>
        )}
        {acoesDeLinhaNova && (
          <AcoesDaLinha>
            <Button
              type="button"
              size="icon"
              className={`size-8 pointer-coarse:size-11 ${OCUPADO}`}
              onClick={() => !salvando && onSalvar()}
              aria-disabled={salvando || undefined}
              aria-busy={salvando}
              aria-label={rotuloSalvar}
              title={rotuloSalvar}
            >
              {salvando ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="size-4" aria-hidden="true" />
              )}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className={`size-8 pointer-coarse:size-11 ${OCUPADO}`}
              onClick={() => !salvando && onLimpar()}
              aria-disabled={salvando || undefined}
              aria-label={rotuloLimpar}
              title={rotuloLimpar}
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </AcoesDaLinha>
        )}
      </Linha>
      {doutroSetor && <Texto variante="nota">{doutroSetor}</Texto>}
      {erroDaLinha && <FieldError id={idDoErroDaLinha}>{erroDaLinha}</FieldError>}
    </Pilha>
  );
}
