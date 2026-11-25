import type { FieldErrors, UseFormRegister } from "react-hook-form";

import { BotaoDeEnvio } from "@/presentation/components/atoms/botao-de-envio.component";
import { Grade, Pilha } from "@/presentation/components/atoms/caixa.component";
import { FieldError } from "@/presentation/components/atoms/field-error.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { CampoDeOpcoes } from "@/presentation/components/molecules/campo-de-opcoes.component";
import { CampoDeTexto } from "@/presentation/components/molecules/campo-de-texto.component";
import { ConfirmacaoDeCadastro } from "@/presentation/components/molecules/confirmacao-de-cadastro.component";
import { opcaoUnica } from "@/shared/kernel/opcoes";
import { PAPEL_LABEL, type PapelCadastravel } from "@/shared/kernel/papeis";
import { SETOR_LABEL } from "@/shared/kernel/setores";

export type CriarUsuarioFormValues = {
  nome: string;
  email: string;
  papel: PapelCadastravel;
  setor: string;
};

type ContaCriada = { nome: string; email: string; senhaProvisoria: string };

type CriarUsuarioFormProps = {
  register: UseFormRegister<CriarUsuarioFormValues>;
  errors: FieldErrors<CriarUsuarioFormValues>;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  pendente: boolean;
  erroServidor?: string;
  criado?: ContaCriada;
  onCadastrarNovo: () => void;
  papeisDisponiveis: PapelCadastravel[];
  setoresDisponiveis: readonly string[];
};

export function CriarUsuarioForm({
  register,
  errors,
  onSubmit,
  pendente,
  erroServidor,
  criado,
  onCadastrarNovo,
  papeisDisponiveis,
  setoresDisponiveis,
}: CriarUsuarioFormProps) {
  const papelUnico = opcaoUnica(papeisDisponiveis);
  const setorUnico = opcaoUnica(setoresDisponiveis);

  if (criado) {
    return (
      <ConfirmacaoDeCadastro
        largura="md"
        onCadastrarNovo={onCadastrarNovo}
        mensagem={
          <>
            Conta de{" "}
            <Texto variante="enfase" como="strong">
              {criado.nome}
            </Texto>{" "}
            ({criado.email}) criada.
          </>
        }
      >
        <>
          <Texto variante="apoio">
            Senha provisória — repasse com segurança, será exigida troca no primeiro acesso:
          </Texto>
          <Texto variante="codigo">{criado.senhaProvisoria}</Texto>
        </>
      </ConfirmacaoDeCadastro>
    );
  }

  return (
    <Pilha espaco="formulario" como="form" onSubmit={onSubmit} noValidate>
      <Grade colunas="1>2" espaco={5}>
        <CampoDeTexto id="nome" rotulo="Nome" erro={errors.nome?.message} {...register("nome")} />
        <CampoDeTexto
          id="email"
          rotulo="E-mail"
          type="email"
          erro={errors.email?.message}
          {...register("email")}
        />
        <CampoDeOpcoes
          id="papel"
          rotulo="Papel"
          opcoes={papeisDisponiveis.map((valor) => ({ valor, rotulo: PAPEL_LABEL[valor] }))}
          placeholder={papelUnico ? undefined : "Selecione"}
          placeholderDesabilitado
          defaultValue={papelUnico ?? ""}
          disabled={!!papelUnico}
          classeDoSelect={papelUnico ? "disabled:opacity-100" : undefined}
          erro={errors.papel?.message}
          {...register("papel")}
        />
        <CampoDeOpcoes
          id="setor"
          rotulo="Setor"
          opcoes={setoresDisponiveis.map((valor) => ({
            valor,
            rotulo: SETOR_LABEL[valor] ?? valor,
          }))}
          placeholder={setorUnico ? undefined : "Selecione"}
          placeholderDesabilitado
          defaultValue={setorUnico ?? ""}
          disabled={!!setorUnico}
          classeDoSelect={setorUnico ? "disabled:opacity-100" : undefined}
          erro={errors.setor?.message}
          {...register("setor")}
        />
      </Grade>

      {erroServidor && <FieldError>{erroServidor}</FieldError>}

      <BotaoDeEnvio pendente={pendente} rotulo="Cadastrar" rotuloPendente="Cadastrando…" />
    </Pilha>
  );
}
