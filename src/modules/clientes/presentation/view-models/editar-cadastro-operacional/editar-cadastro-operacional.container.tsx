"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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

import { AnexarGuiaParcelaPgfnContainer } from "../anexar-guia-parcela-pgfn/anexar-guia-parcela-pgfn.container";
import { DocumentoContratualDoClienteContainer } from "../visualizar-documento-contratual/documento-contratual-do-cliente.container";
import {
  contatoNovo,
  descartarLinhasEmBranco,
  leituraDaLinha,
  nomeResponsavelAtual,
  OPCOES_DOCUMENTO,
  OPCOES_FORMA_ENVIO,
  opcoesDeDas,
  opcoesResponsavel,
  parcelamentoNovo,
  reposicionarErros,
  resumoDoAcordo,
} from "./editar-cadastro-operacional.presenter";
import { editarCadastroOperacionalFormSchema } from "./editar-cadastro-operacional.schema";
import { useResponsaveisElegiveis } from "./responsaveis.queries";
import { useLeituraDoPdf } from "./use-leitura-do-pdf.hook";
import { useSalvarCadastroOperacional } from "./use-salvar-cadastro-operacional.hook";

type Props = {
  dados: CadastroOperacionalClienteDto | null;
  readOnly: boolean;
  // Só o Líder do SN, neste cadastro (os outros Setores têm o bloco próprio): troca o Select de Responsável editável.
  podeAtribuirResponsavel?: boolean;
  onCancelar?: () => void;
  // Depois de salvar com sucesso, o painel precisa fechar/voltar: painel embutido no dashboard
  // (busca do /simples-nacional) fecha de volta pra busca e atualiza os cards; tela própria
  // (/clientes/[id]) navega de volta pra onde a lista do bucket (ou o próprio dashboard) ficou.
  // Os dois destinos são exclusivos: união discriminada por `tipo`.
  aoSalvar?: { tipo: "fechar"; executar: () => void } | { tipo: "voltar"; href: string };
  // Carga inicial do servidor (tela própria); no painel embutido da busca vem vazia e o botão lê por action.
  documentosContratuais?: DocumentoContratualVisivelDto[];
  // Só o Admin na tela própria: o botão de anexar fica no cartão do documento.
  podeAnexar?: boolean;
  // Nº da alteração do aviso por onde se chegou: o cartão do documento a abre e destaca o botão.
  alteracaoEmFoco?: number;
};

export function EditarCadastroOperacionalContainer({
  dados,
  readOnly,
  podeAtribuirResponsavel = false,
  onCancelar,
  aoSalvar,
  documentosContratuais,
  podeAnexar,
  alteracaoEmFoco,
}: Props) {
  // Falso no servidor e na hidratação; verdadeiro assim que o cliente assume (snapshots do React).
  const hidratado = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  // Extraído pra reusar no reset() do botão "Limpar" — reverte pro que veio
  // do servidor, não esvazia campos (formaEnvio é enum obrigatório, sem opção
  // em branco no Select; "limpar" um form de edição significa desfazer, não zerar).
  const valoresIniciais = dados
    ? {
        formaEnvio:
          (dados.formaEnvio as EditarCadastroOperacionalFormValues["formaEnvio"]) ?? "whatsapp",
        // Seção sem registros abre com uma linha em branco (descartada se ninguém a tocar).
        contatos: dados.contatos.length || readOnly ? dados.contatos : [contatoNovo(true)],
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

  const {
    register,
    control,
    handleSubmit,
    reset,
    getValues,
    setValue,
    setError,
    formState: { errors },
  } = useForm<EditarCadastroOperacionalFormValues>({
    // Valida sem as linhas em branco; o que sai daqui (inclusive para o submit) já vem sem elas.
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

  // Lido no render, sem assinar o campo: o que a tela exibe (resumo, selo, quitado, nome do PDF) só
  // muda quando uma linha entra ou sai (`parcelamentoCampos` re-renderiza), não a cada tecla.
  const parcelamentos = (getValues("parcelamentos") ?? dados?.parcelamentos ?? []).map((p) => ({
    ...p,
    acordoResumo: resumoDoAcordo(p.acordo),
  }));
  // Lista de Funcionários só é buscada quando o Líder abre o Select.
  const [listaAberta, setListaAberta] = useState(false);
  const elegiveis = useResponsaveisElegiveis(podeAtribuirResponsavel && listaAberta);
  const { fields, append, remove } = useFieldArray({ control, name: "contatos" });
  const parcelamentoCampos = useFieldArray({ control, name: "parcelamentos" });
  // A leitura do PDF termina depois de a lista poder ter mudado: acha a linha pelo id, no momento.
  const camposAtuais = useRef(parcelamentoCampos.fields);
  useEffect(() => {
    camposAtuais.current = parcelamentoCampos.fields;
  });
  const leitura = useLeituraDoPdf(dados?.id ?? "", setValue, (id) =>
    camposAtuais.current.findIndex((campo) => campo.id === id),
  );

  const { salvar, pendente, erroServidor, sucesso, limparMensagens } = useSalvarCadastroOperacional(
    {
      dados,
      podeAtribuirResponsavel,
      aoSalvar,
      getValues,
      setValue,
      setError,
    },
  );
  const aoSubmeter = handleSubmit(salvar);

  const aoLimpar = () => {
    reset(valoresIniciais);
    leitura.esquecerTodas();
    limparMensagens();
  };

  if (!dados) {
    return <Texto variante="apoio">Cliente não encontrado.</Texto>;
  }

  if (!regimeTemCadastroOperacionalSn(dados.regime)) {
    // Documento jurídico não depende do cadastro SN: Admin ainda abre e anexa em Lucro Presumido/Real.
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
      parcelamentos={parcelamentos}
      dasEnviadoPeloSistema={dados?.dasStatus === "enviado"}
      opcoes={{
        formaEnvio: OPCOES_FORMA_ENVIO,
        documento: OPCOES_DOCUMENTO,
        das: opcoesDeDas(dados.dasStatus === "enviado"),
      }}
      erroServidor={erroServidor}
      sucesso={sucesso}
      oculto={!hidratado}
      contatos={fields}
      onAdicionarContato={() => append(contatoNovo(fields.length === 0))}
      onRemoverContato={remove}
      parcelamentoCampos={parcelamentoCampos.fields}
      onAdicionarParcelamento={() => parcelamentoCampos.append(parcelamentoNovo())}
      onRemoverParcelamento={(indice) => {
        void leitura.ler(parcelamentoCampos.fields[indice].id, undefined); // esquece a leitura da linha
        parcelamentoCampos.remove(indice);
      }}
      leituras={Object.fromEntries(
        Object.entries(leitura.leituras).map(([id, estado]) => [id, leituraDaLinha(estado)]),
      )}
      onArquivoEscolhido={(indice, arquivo) =>
        void leitura.ler(parcelamentoCampos.fields[indice].id, arquivo)
      }
      onLimpar={aoLimpar}
      onCancelar={onCancelar}
      guiasDaParcela={(parcelamentoId, codigo, interno) => (
        <AnexarGuiaParcelaPgfnContainer
          parcelamentoId={parcelamentoId}
          codigo={codigo}
          interno={interno}
        />
      )}
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
