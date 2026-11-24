"use client";

import { useState, useSyncExternalStore } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";

import { Pilha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import {
  EditarCadastroOperacionalForm,
  type EditarCadastroOperacionalFormValues,
} from "@/presentation/components/organisms/editar-cadastro-operacional-form.component";
import type { DocumentoContratualVisivelDto } from "@/modules/clientes/application/ports/in/documentos-contratuais-cliente.provider";
import type { CadastroOperacionalClienteDto } from "@/modules/clientes/application/ports/out/cliente-query.provider";
import { REGIME_LABEL, regimeTemCadastroOperacionalSn } from "@/shared/kernel/regimes";
import { SETOR_SN } from "@/shared/kernel/setores";

import { guiasDaParcela } from "../anexar-guia-parcela-pgfn/anexar-guia-parcela-pgfn.container";
import { DocumentoContratualDoClienteContainer } from "../visualizar-documento-contratual/documento-contratual-do-cliente.container";
import {
  contatoNovo,
  descartarLinhasEmBranco,
  nomeResponsavelAtual,
  OPCOES_DOCUMENTO,
  opcoesDeDas,
  opcoesResponsavel,
  parcelamentoNovo,
  reposicionarErros,
} from "./editar-cadastro-operacional.presenter";
import { editarCadastroOperacionalFormSchema } from "./editar-cadastro-operacional.schema";
import { useResponsaveisElegiveis } from "./responsaveis.queries";
import { contatosIniciais } from "./tipos-de-envio.presenter";
import { useContatosDoCadastro } from "./use-contatos-do-cadastro.hook";
import { useParcelamentosDoCadastro } from "./use-parcelamentos-do-cadastro.hook";
import { useSalvarCadastroOperacional } from "./use-salvar-cadastro-operacional.hook";

type Props = {
  dados: CadastroOperacionalClienteDto | null;
  readOnly: boolean;
  ator: { papel: string; setor: string };
  podeAtribuirResponsavel?: boolean;
  onCancelar?: () => void;
  aoSalvar?: { tipo: "fechar"; executar: () => void } | { tipo: "voltar"; href: string };
  documentosContratuais?: DocumentoContratualVisivelDto[];
  podeAnexar?: boolean;
  alteracaoEmFoco?: number;
};

export function EditarCadastroOperacionalContainer({
  dados,
  readOnly,
  ator,
  podeAtribuirResponsavel = false,
  onCancelar,
  aoSalvar,
  documentosContratuais,
  podeAnexar,
  alteracaoEmFoco,
}: Props) {
  const hidratado = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const admin = ator.papel === "admin";
  const valoresIniciais = dados
    ? {
        formaEnvio:
          (dados.formaEnvio as EditarCadastroOperacionalFormValues["formaEnvio"]) ?? "whatsapp",
        contatos: contatosIniciais(dados.contatos, dados.destinos, {
          verTodos: admin || readOnly,
          setor: SETOR_SN,
          somenteLeitura: readOnly,
        }),
        documentoObrigatorio:
          dados.documentoObrigatorio as EditarCadastroOperacionalFormValues["documentoObrigatorio"],
        dasStatus: dados.dasStatus as EditarCadastroOperacionalFormValues["dasStatus"],
        dataEnvioDas: dados.dataEnvioDas,
        parcelamentos:
          dados.parcelamentos.length || readOnly ? dados.parcelamentos : [parcelamentoNovo()],
        observacoesGerais: dados.observacoesGerais,
        atividadeMes: dados.atividadeMes,
        responsavelId: dados.responsavelId ?? "",
      }
    : undefined;

  const form = useForm<EditarCadastroOperacionalFormValues>({
    resolver: async (valores, contexto, opcoes) => {
      const semBranco = descartarLinhasEmBranco(valores);
      const resultado = await zodResolver(editarCadastroOperacionalFormSchema)(
        semBranco.valores,
        contexto,
        opcoes,
      );
      return {
        ...resultado,
        errors: {
          ...resultado.errors,
          ...(resultado.errors.contatos && {
            contatos: reposicionarErros(resultado.errors.contatos, semBranco.contatos),
          }),
          ...(resultado.errors.parcelamentos && {
            parcelamentos: reposicionarErros(
              resultado.errors.parcelamentos,
              semBranco.parcelamentos,
            ),
          }),
        },
      } as typeof resultado;
    },
    defaultValues: valoresIniciais,
  });
  const {
    register,
    control,
    handleSubmit,
    reset,
    getValues,
    setValue,
    setError,
    formState: { errors },
  } = form;

  const [listaAberta, setListaAberta] = useState(false);
  const elegiveis = useResponsaveisElegiveis(podeAtribuirResponsavel && listaAberta);
  const { fields, append, remove } = useFieldArray({ control, name: "contatos" });
  const linhasDeContato = useContatosDoCadastro({
    clienteId: dados?.id ?? "",
    form,
    campos: fields,
    remover: remove,
    destinos: dados?.destinos ?? [],
    tiposDeEnvio: dados?.tiposDeEnvio ?? [],
    setorDoCadastro: SETOR_SN,
    admin,
    verTodos: admin || readOnly,
  });
  const parcelamentos = useParcelamentosDoCadastro({
    clienteId: dados?.id ?? "",
    setor: "simples_nacional",
    salvos: dados?.parcelamentos ?? [],
    control,
    getValues,
    setValue,
  });

  const { salvar, pendente, erroServidor, sucesso, limparMensagens } = useSalvarCadastroOperacional(
    {
      dados,
      podeAtribuirResponsavel,
      aoSalvar,
      salvarParcelamentos: parcelamentos.salvar,
      setError,
    },
  );
  const aoSubmeter = handleSubmit(salvar);

  const aoLimpar = () => {
    reset(valoresIniciais);
    parcelamentos.esquecerLeituras();
    limparMensagens();
  };

  if (!dados) {
    return <Texto variante="apoio">Cliente não encontrado.</Texto>;
  }

  if (!regimeTemCadastroOperacionalSn(dados.regime)) {
    return (
      <Pilha espaco={6}>
        <Texto variante="apoio" role="status">
          O Cadastro operacional do Simples Nacional não se aplica ao Regime{" "}
          {REGIME_LABEL[dados.regime] ?? dados.regime}.
        </Texto>
        <DocumentoContratualDoClienteContainer
          clienteId={dados.id}
          documentosIniciais={documentosContratuais}
          podeAnexar={podeAnexar}
          alteracaoEmFoco={alteracaoEmFoco}
        />
      </Pilha>
    );
  }

  return (
    <EditarCadastroOperacionalForm
      cabecalho={{ empresa: dados.empresa, cnpj: dados.cnpj, regime: dados.regime }}
      register={register}
      control={control}
      errors={errors}
      onSubmit={aoSubmeter}
      pendente={pendente}
      readOnly={readOnly}
      responsavel={{
        editavel: podeAtribuirResponsavel,
        nomeAtual: nomeResponsavelAtual(dados),
        opcoes: opcoesResponsavel(dados, elegiveis.data ?? []),
        onAbrir: () => setListaAberta(true),
        estadoLista: elegiveis.isError ? "erro" : elegiveis.isLoading ? "carregando" : "ok",
        onTentarNovamente: () => void elegiveis.refetch(),
      }}
      dasEnviadoPeloSistema={dados?.dasStatus === "enviado"}
      opcoes={{
        documento: OPCOES_DOCUMENTO,
        das: opcoesDeDas(dados.dasStatus === "enviado"),
      }}
      erroServidor={erroServidor}
      sucesso={sucesso}
      oculto={!hidratado}
      contatos={fields}
      onAdicionarContato={() => append(contatoNovo())}
      linhasDeContato={linhasDeContato}
      parcelamentoCampos={parcelamentos.parcelamentoCampos}
      parcelamentos={parcelamentos.parcelamentos}
      onAdicionarParcelamento={parcelamentos.onAdicionarParcelamento}
      onRemoverParcelamento={parcelamentos.onRemoverParcelamento}
      leituras={parcelamentos.leituras}
      onArquivoEscolhido={parcelamentos.onArquivoEscolhido}
      onLimpar={aoLimpar}
      onCancelar={onCancelar}
      guiasDaParcela={guiasDaParcela}
      documentoContratual={
        <DocumentoContratualDoClienteContainer
          clienteId={dados.id}
          documentosIniciais={documentosContratuais}
          podeAnexar={podeAnexar}
          alteracaoEmFoco={alteracaoEmFoco}
        />
      }
    />
  );
}
