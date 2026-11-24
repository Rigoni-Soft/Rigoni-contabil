import { Check, LoaderCircle, Pencil, Trash2, X } from "lucide-react";

import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { FieldError } from "@/presentation/components/atoms/field-error.component";
import { CampoDeTexto } from "@/presentation/components/molecules/campo-de-texto.component";
import { ConfirmacaoEmLinha } from "@/presentation/components/molecules/confirmacao-em-linha.component";
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
export type ConfirmacaoDeRemocao = {
  texto: string;
  onConfirmar: () => void;
  onCancelar: () => void;
};

type LinhaDeContatoProps = {
  indice: number;
  numero?: number;
  nome: React.ComponentProps<"input">;
  telefone: React.ComponentProps<"input">;
  email: React.ComponentProps<"input">;
  erroNome?: string;
  erroTelefone?: string;
  erroEmail?: string;
  editando: boolean;
  salvo?: boolean;
  salvando?: boolean;
  camposTravados?: boolean;
  erroDaLinha?: string;
  onEditar?: () => void;
  onSalvar?: () => void;
  onCancelar?: () => void;
  onRemover?: () => void;
  rotuloDaLixeira?: string;
  confirmacaoDeRemocao?: ConfirmacaoDeRemocao;
  somenteLeitura?: boolean;
  envios?: EnviosDaLinha;
  existentes?: ExistentesDaLinha;
  numeroRepetido?: NumeroRepetidoDaLinha;
};

function AcoesDaLinha({ children }: { children: React.ReactNode }) {
  return (
    <Pilha espaco="campo">
      <Label aria-hidden="true" className="invisible max-sm:hidden">
        &nbsp;
      </Label>
      <Linha alinhar="centro" espaco={1} className="h-9 pointer-coarse:h-11">
        {children}
      </Linha>
    </Pilha>
  );
}

const ICONE_PEQUENO = "size-8 pointer-coarse:size-11";
const CAMPO_TRAVADO = "[&_input:read-only]:bg-muted [&_input:read-only]:cursor-default";

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
  const travado = travadoPorFora ? { readOnly: true } : {};
  const classeDoCampo = `min-w-[10rem] flex-1 gap-1 ${CAMPO_TRAVADO}`;
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
            <ConfirmacaoEmLinha
              texto={confirmacaoDeRemocao.texto}
              idDoTexto={`contatos.${indice}.confirmacao-texto`}
              rotuloDoConfirmar="Deixar de usar"
              rotuloEmCurso="Deixando de usar…"
              nomeDoConfirmar="Deixar de usar"
              nomeDoCancelar="Manter"
              rotuloDoCancelar="Manter"
              focoInicial="confirmar"
              destrutiva
              emCurso={Boolean(salvando)}
              ocupado={Boolean(salvando)}
              onConfirmar={() => !salvando && confirmacaoDeRemocao.onConfirmar()}
              onCancelar={() => !salvando && confirmacaoDeRemocao.onCancelar()}
            />
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
