import { UserPlus } from "lucide-react";
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
  // Chamado ao clicar "Cadastrar outro" na tela de confirmação — quem monta a
  // página decide o que isso significa (aqui: limpar o formulário e continuar).
  onCadastrarNovo: () => void;
  // Escopado por RBAC em quem monta a página (Admin vê tudo, Líder de setor só o
  // próprio Setor) — o formulário só reflete o que já é permitido, não decide.
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
  // Quando só há 1 opção possível (Líder de setor: só "funcionario" no próprio
  // Setor), não faz sentido pedir pra escolher — já vem selecionado e travado.
  const papelUnico = opcaoUnica(papeisDisponiveis);
  const setorUnico = opcaoUnica(setoresDisponiveis);

  if (criado) {
    return (
      <ConfirmacaoDeCadastro
        largura="md"
        iconeNovo={<UserPlus aria-hidden="true" />}
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
        detalhes={
          <>
            <Texto variante="apoio">
              Senha provisória — repasse com segurança, será exigida troca no primeiro acesso:
            </Texto>
            <Texto variante="codigo">{criado.senhaProvisoria}</Texto>
          </>
        }
      />
    );
  }

  return (
    <Pilha espaco="formulario" como="form" onSubmit={onSubmit} noValidate>
      {/* Nome/E-mail/Papel/Setor cabem lado a lado — 2 colunas aproveita melhor
          a largura do formulário (80% da tela, #36) do que empilhar tudo numa
          coluna só. */}
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
