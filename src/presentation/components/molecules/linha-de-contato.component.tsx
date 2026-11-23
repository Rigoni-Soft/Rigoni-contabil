import { Check, LoaderCircle, Pencil, Trash2, X } from "lucide-react";

import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { FieldError } from "@/presentation/components/atoms/field-error.component";
import { CampoDeTexto } from "@/presentation/components/molecules/campo-de-texto.component";
import {
  EnviosDoContato,
  type EnviosDaLinha,
} from "@/presentation/components/molecules/envios-do-contato.component";
import {
  EscolhaDeContato,
  type ExistentesDaLinha,
} from "@/presentation/components/molecules/escolha-de-contato.component";
import { Button } from "@/presentation/components/ui/button";
import { Label } from "@/presentation/components/ui/label";
import { BOTAO_OCUPADO } from "@/presentation/lib/botao-ocupado";

export type NumeroRepetidoDaLinha = { texto: string; onUsar?: () => void };
// A pergunta "Deixar de usar este contato?" que a lixeira do contato de outro dono abre antes de agir.
export type ConfirmacaoDeRemocao = {
  texto: string;
  onConfirmar: () => void;
  onCancelar: () => void;
};

type LinhaDeContatoProps = {
  indice: number;
  // Número mostrado e usado nos nomes acessíveis ("Contato N"); sem ele, o índice mais um. Contato escondido não conta.
  numero?: number;
  // Props dos inputs (o `register`/Controller do formulário, já resolvidos por quem monta).
  nome: React.ComponentProps<"input">;
  telefone: React.ComponentProps<"input">;
  email: React.ComponentProps<"input">;
  erroNome?: string;
  erroTelefone?: string;
  erroEmail?: string;
  // Editando: Salvar e Cancelar, e os campos e checkboxes aceitam alteração. Fora disso a linha só mostra:
  // Editar e, para o dono, a lixeira.
  editando: boolean;
  // Contato já gravado (tem id): só ele pode ser removido.
  salvo?: boolean;
  salvando?: boolean;
  // Contato de outro Setor: nome, WhatsApp e e-mail ficam sempre só de leitura; os envios são do Setor.
  camposTravados?: boolean;
  // Falha do servidor ao salvar esta linha (não é de um campo).
  erroDaLinha?: string;
  onEditar?: () => void;
  onSalvar?: () => void;
  onCancelar?: () => void;
  // Sem callback (visualização, ou contato que o Setor não remove): o botão nem aparece.
  onRemover?: () => void;
  // Nome acessível da lixeira quando não é "Remover contato N" (contato de outro dono: "Deixar de usar…").
  rotuloDaLixeira?: string;
  // A lixeira do contato de outro dono pergunta antes de agir; presente, a pergunta está aberta.
  confirmacaoDeRemocao?: ConfirmacaoDeRemocao;
  // Visualização da tela toda: sem botões nem asterisco.
  somenteLeitura?: boolean;
  // O que este contato recebe do Setor de quem edita (ausente: o ator não define envios, como o Admin).
  envios?: EnviosDaLinha;
  // Linha nova do Setor: escolher um contato que outro Setor já cadastrou, em vez de digitar um novo.
  existentes?: ExistentesDaLinha;
  // Linha nova: o número digitado já é de um contato do Cliente; `onUsar` ausente = ele já está na lista.
  numeroRepetido?: NumeroRepetidoDaLinha;
};

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

const ICONE_PEQUENO = "size-8 pointer-coarse:size-11";
// Campo travado da linha: fundo neutro e cursor comum (só aqui; o `Input` do sistema segue como está).
const CAMPO_TRAVADO = "[&_input:read-only]:bg-muted [&_input:read-only]:cursor-default";

// Um Contato do Cliente: nome, telefone, e-mail (ao menos um dos dois canais), o que ele recebe do Setor e as
// ações da linha (Editar e Lixeira; editando, Salvar e Cancelar). A numeração é 1-based.
export function LinhaDeContato({
  indice,
  numero: numeroDaTela,
  nome,
  telefone,
  email,
  erroNome,
  erroTelefone,
  erroEmail,
  editando,
  salvo,
  salvando,
  camposTravados,
  erroDaLinha,
  onEditar,
  onSalvar,
  onCancelar,
  onRemover,
  rotuloDaLixeira,
  confirmacaoDeRemocao,
  somenteLeitura,
  envios,
  existentes,
  numeroRepetido,
}: LinhaDeContatoProps) {
  const numero = numeroDaTela ?? indice + 1;
  const comAcoes = !somenteLeitura;
  const travadoPorFora = !editando || camposTravados;
  // `readOnly` e não `disabled`: o valor segue no formulário e volta intacto ao salvar o cadastro.
  const travado = travadoPorFora ? { readOnly: true } : {};
  const classeDoCampo = `min-w-[10rem] flex-1 gap-1 ${CAMPO_TRAVADO}`;
  // Linha nova do Setor com contatos de outros Setores para escolher: Nome, WhatsApp e E-mail são seleções.
  // Sem nenhum contato de outro Setor para escolher, a linha nova já tem campos de texto.
  const escolha =
    existentes &&
    existentes.opcoes.length > 0 &&
    !existentes.modoNovo &&
    editando &&
    comAcoes &&
    !camposTravados
      ? existentes
      : undefined;
  const idDoErroDaLinha = `contatos.${indice}.linha-mensagem`;
  const idDoNumeroRepetido = `contatos.${indice}.telefone-repetido`;
  const rotuloEditar = `Editar contato ${numero}`;
  const rotuloSalvar = `Salvar contato ${numero}`;
  const rotuloCancelar = `Cancelar edição do contato ${numero}`;
  const rotuloRemover = rotuloDaLixeira ?? `Remover contato ${numero}`;
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
        {escolha ? (
          <EscolhaDeContato
            indice={indice}
            existentes={escolha}
            erros={{ nome: erroNome, telefone: erroTelefone, email: erroEmail }}
          />
        ) : (
          <>
            <CampoDeTexto
              id={`contatos.${indice}.nome`}
              rotulo="Nome"
              obrigatorio={editando && !camposTravados && comAcoes}
              erro={erroNome}
              className={classeDoCampo}
              {...nome}
              {...travado}
            />
            <CampoDeTexto
              id={`contatos.${indice}.telefone`}
              rotulo="WhatsApp"
              inputMode="tel"
              erro={erroTelefone}
              aria-describedby={numeroRepetido ? idDoNumeroRepetido : undefined}
              className={classeDoCampo}
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
              className={classeDoCampo}
              {...email}
              {...travado}
            />
          </>
        )}
        {comAcoes && editando && onSalvar && onCancelar && (
          <AcoesDaLinha>
            <Button
              type="button"
              size="icon"
              className={`${ICONE_PEQUENO} ${BOTAO_OCUPADO}`}
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
              className={`${ICONE_PEQUENO} ${BOTAO_OCUPADO}`}
              onClick={() => !salvando && onCancelar()}
              aria-disabled={salvando || undefined}
              aria-label={rotuloCancelar}
              title={rotuloCancelar}
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </AcoesDaLinha>
        )}
        {comAcoes && !editando && onEditar && (
          <AcoesDaLinha>
            <Button
              id={`contatos.${indice}.editar`}
              type="button"
              variant="outline"
              size="icon"
              className={ICONE_PEQUENO}
              onClick={onEditar}
              aria-label={rotuloEditar}
              title={rotuloEditar}
            >
              <Pencil className="size-4" aria-hidden="true" />
            </Button>
            {salvo && onRemover && (
              <Button
                id={`contatos.${indice}.remover`}
                type="button"
                variant="destructive"
                size="icon"
                className={ICONE_PEQUENO}
                onClick={onRemover}
                aria-label={rotuloRemover}
                title={rotuloRemover}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            )}
          </AcoesDaLinha>
        )}
        {confirmacaoDeRemocao && (
          <Linha alinhar="centro" espaco={3} quebra className="basis-full">
            <AvisoDeStatus tipo="atencao" legivel texto={confirmacaoDeRemocao.texto} />
            <Button
              id={`contatos.${indice}.confirmar-remocao`}
              type="button"
              variant="destructive"
              size="sm"
              className={`pointer-coarse:h-11 ${BOTAO_OCUPADO}`}
              aria-disabled={salvando || undefined}
              onClick={() => !salvando && confirmacaoDeRemocao.onConfirmar()}
            >
              Deixar de usar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={`pointer-coarse:h-11 ${BOTAO_OCUPADO}`}
              aria-disabled={salvando || undefined}
              onClick={() => !salvando && confirmacaoDeRemocao.onCancelar()}
            >
              Manter
            </Button>
          </Linha>
        )}
        {numeroRepetido && !escolha && (
          <Linha alinhar="centro" espaco={3} quebra className="basis-full">
            <AvisoDeStatus
              tipo="atencao"
              legivel
              id={idDoNumeroRepetido}
              texto={numeroRepetido.texto}
            />
            {numeroRepetido.onUsar && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="pointer-coarse:h-11"
                onClick={numeroRepetido.onUsar}
              >
                Usar este contato
              </Button>
            )}
          </Linha>
        )}
        {envios && (
          <EnviosDoContato indice={indice} numero={numero} envios={envios} editando={editando} />
        )}
      </Linha>
      {erroDaLinha && <FieldError id={idDoErroDaLinha}>{erroDaLinha}</FieldError>}
    </Pilha>
  );
}
