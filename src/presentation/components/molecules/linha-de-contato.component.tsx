import { Check, LoaderCircle, Pencil, Trash2, X } from "lucide-react";

import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { CaixaDeMarcacao } from "@/presentation/components/atoms/caixa-de-marcacao.component";
import { Caixa, Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { FieldError } from "@/presentation/components/atoms/field-error.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { CampoDeOpcoes } from "@/presentation/components/molecules/campo-de-opcoes.component";
import { CampoDeTexto } from "@/presentation/components/molecules/campo-de-texto.component";
import { Button } from "@/presentation/components/ui/button";
import { Label } from "@/presentation/components/ui/label";
import { BOTAO_OCUPADO } from "@/presentation/lib/botao-ocupado";

// O que o contato recebe do Setor de quem edita (checkboxes da linha); só o Setor vê o que marcou.
export type EnviosDaLinha = {
  opcoes: { valor: string; rotulo: string }[];
  marcados: string[];
  // O canal que o envio usa e o contato deixou de ter.
  aviso?: string;
  onAlternar: (valor: string) => void;
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
  // Visualização da tela toda: sem botões nem asterisco.
  somenteLeitura?: boolean;
  // O que este contato recebe do Setor de quem edita (ausente: o ator não define envios, como o Admin).
  envios?: EnviosDaLinha;
  // Linha nova do Setor: escolher um contato que outro Setor já cadastrou, em vez de digitar um novo.
  existentes?: ExistentesDaLinha;
};
// Os contatos que outro Setor já cadastrou: na linha nova do Setor, Nome, WhatsApp e E-mail viram seleções
// (escolher um preenche e trava a linha) com a opção "+ Cadastrar novo", que troca os três por campos de
// texto (`modoNovo`).
export type ExistentesDaLinha = {
  opcoes: { id: string; nome: string; telefone: string; email: string }[];
  modoNovo: boolean;
  onEscolher: (contatoId: string) => void;
  onNovo: () => void;
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
// O valor da opção "+ Cadastrar novo" nas seleções da linha nova (não é id de contato).
const NOVO_CONTATO = "__novo__";

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
  somenteLeitura,
  envios,
  existentes,
}: LinhaDeContatoProps) {
  const numero = numeroDaTela ?? indice + 1;
  const comAcoes = !somenteLeitura;
  // `readOnly` e não `disabled`: o valor segue no formulário e volta intacto ao salvar o cadastro.
  const travado = !editando || camposTravados ? { readOnly: true } : {};
  // Linha nova do Setor com contatos de outros Setores para escolher: Nome, WhatsApp e E-mail são seleções
  // (cada uma lista o que esse campo tem nos contatos já cadastrados, mais "Cadastrar novo"). Escolher um
  // contato preenche a linha; "Cadastrar novo" em qualquer um dos três troca os três por campos de texto.
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
  const selecao = (
    escolha: ExistentesDaLinha,
    campo: "nome" | "telefone" | "email",
    rotulo: string,
    erro?: string,
  ) => (
    <CampoDeOpcoes
      id={`contatos.${indice}.${campo}`}
      rotulo={rotulo}
      obrigatorio={campo === "nome"}
      erro={erro}
      opcoes={[
        ...escolha.opcoes
          .filter((opcao) => opcao[campo].trim())
          .map((opcao) => ({ valor: opcao.id, rotulo: opcao[campo] })),
        { valor: NOVO_CONTATO, rotulo: "+ Cadastrar novo" },
      ]}
      placeholder="Escolher contato"
      className="min-w-[10rem] flex-1 gap-1"
      value=""
      onChange={(evento) =>
        evento.target.value === NOVO_CONTATO
          ? escolha.onNovo()
          : escolha.onEscolher(evento.target.value)
      }
    />
  );
  const idDoErroDaLinha = `contatos.${indice}.linha-mensagem`;
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
          <>
            {selecao(escolha, "nome", "Nome", erroNome)}
            {selecao(escolha, "telefone", "WhatsApp", erroTelefone)}
            {selecao(escolha, "email", "E-mail", erroEmail)}
          </>
        ) : (
          <>
            <CampoDeTexto
              id={`contatos.${indice}.nome`}
              rotulo="Nome"
              obrigatorio={editando && !camposTravados && comAcoes}
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
        {envios && (
          <Caixa
            como="fieldset"
            aria-label={`Envios do contato ${numero}`}
            className="flex basis-full flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-2"
          >
            <Texto variante="rotulo" como="span">
              Recebe
            </Texto>
            {envios.opcoes.map((opcao) => (
              <CaixaDeMarcacao
                key={opcao.valor}
                id={`contatos.${indice}.tipo-${opcao.valor}`}
                rotulo={opcao.rotulo}
                checked={envios.marcados.includes(opcao.valor)}
                disabled={!editando}
                onChange={() => envios.onAlternar(opcao.valor)}
              />
            ))}
            {envios.aviso && <AvisoDeStatus tipo="atencao" legivel texto={envios.aviso} />}
          </Caixa>
        )}
      </Linha>
      {erroDaLinha && <FieldError id={idDoErroDaLinha}>{erroDaLinha}</FieldError>}
    </Pilha>
  );
}
