"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
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

import { DocumentoContratualDoClienteContainer } from "../visualizar-documento-contratual/documento-contratual-do-cliente.container";
import { atribuirResponsavelAction } from "./atribuir-responsavel.actions";
import { editarCadastroOperacionalAction } from "./editar-cadastro-operacional.actions";
import {
  leituraDaLinha,
  mudouParcelamentos,
  nomeResponsavelAtual,
  opcoesResponsavel,
  resumoDoAcordo,
} from "./editar-cadastro-operacional.presenter";
import { editarCadastroOperacionalFormSchema } from "./editar-cadastro-operacional.schema";
import { useResponsaveisElegiveis } from "./responsaveis.queries";
import { salvarParcelamentosAction } from "./salvar-parcelamentos.actions";
import { useLeituraDoPdf } from "./use-leitura-do-pdf.hook";

type Props = {
  dados: CadastroOperacionalClienteDto | null;
  readOnly: boolean;
  // Só o Líder do SN: troca o Select de Responsável editável.
  podeAtribuirResponsavel?: boolean;
  onCancelar?: () => void;
  // Depois de salvar com sucesso, o painel precisa fechar/voltar: painel embutido no dashboard
  // (busca do /simples-nacional) fecha de volta pra busca e atualiza os cards; tela própria
  // (/clientes/[id]) navega de volta pra onde a lista do bucket (ou o próprio dashboard) ficou. Só
  // um dos dois é passado por consumidor — `aoSalvarComSucesso` tem prioridade.
  aoSalvarComSucesso?: () => void;
  voltarHrefAoSalvar?: string;
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
  aoSalvarComSucesso,
  voltarHrefAoSalvar,
  documentosContratuais,
  podeAnexar,
  alteracaoEmFoco,
}: Props) {
  const router = useRouter();
  const [pendente, setPendente] = useState(false);
  const [erroServidor, setErroServidor] = useState<string | undefined>();
  const [sucesso, setSucesso] = useState(false);
  // Falso no servidor e na hidratação; verdadeiro assim que o cliente assume (snapshots do React).
  const hidratado = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  // Depois de salvar o cadastro e falhar só a atribuição, guarda o que
  // foi persistido (campos sem o Responsável); reenviar o mesmo formulário repete só a atribuição.
  // Se a pessoa mexer em outro campo, o retrato muda e o salvamento completo volta.
  const [cadastroSalvo, setCadastroSalvo] = useState<string | null>(null);

  // Extraído pra reusar no reset() do botão "Limpar" — reverte pro que veio
  // do servidor, não esvazia campos (formaEnvio é enum obrigatório, sem opção
  // em branco no Select; "limpar" um form de edição significa desfazer, não zerar).
  const valoresIniciais = dados
    ? {
        formaEnvio:
          (dados.formaEnvio as EditarCadastroOperacionalFormValues["formaEnvio"]) ?? "whatsapp",
        contatos: dados.contatos,
        documentoObrigatorio:
          dados.documentoObrigatorio as EditarCadastroOperacionalFormValues["documentoObrigatorio"],
        dasStatus: dados.dasStatus as EditarCadastroOperacionalFormValues["dasStatus"],
        dataEnvioDas: dados.dataEnvioDas,
        parcelamentos: dados.parcelamentos,
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
    resolver: zodResolver(editarCadastroOperacionalFormSchema),
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

  const aoSubmeter = handleSubmit(async (valores) => {
    if (!dados) return;
    setPendente(true);
    setErroServidor(undefined);
    setSucesso(false);

    // Vira true quando o cadastro está persistido (nesta tentativa ou numa anterior): a mensagem
    // de erro de transporte precisa dizer isso em vez de sugerir que nada foi salvo.
    let cadastroPersistido = false;
    // O que falta concluir depois do cadastro salvo: nomeia a etapa na mensagem de erro de transporte.
    let etapa = "atribuir o Responsável";
    // try/finally: rejeição de transporte da Server Action não pode deixar o
    // botão preso em "Salvando...".
    try {
      // O Responsável é salvo à parte: fica fora do retrato que decide se o cadastro mudou.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { responsavelId: _responsavelId, parcelamentos: _parcelamentos, ...cadastro } = valores;
      const retrato = JSON.stringify(cadastro);
      if (cadastroSalvo !== retrato) {
        const resultado = await editarCadastroOperacionalAction({
          ...valores,
          clienteId: dados.id,
        });

        if (!resultado.ok) {
          setErroServidor(resultado.error.message);
          for (const [campo, mensagens] of Object.entries(resultado.error.fields ?? {})) {
            if (mensagens[0] && campo !== "clienteId") {
              setError(campo as keyof EditarCadastroOperacionalFormValues, {
                message: mensagens[0],
              });
            }
          }
          return;
        }
      }
      // O retrato é guardado assim que o cadastro persiste, antes
      // da atribuição, para valer também quando a atribuição rejeita por erro de transporte.
      setCadastroSalvo(retrato);
      cadastroPersistido = true;

      // Parcelamentos têm PDF: vão por Server Action própria, depois do cadastro. Sem mudança, não vão.
      if (mudouParcelamentos(valores.parcelamentos, dados.parcelamentos)) {
        etapa = "salvar os Parcelamentos";
        const salvos = await salvarParcelamentosAction({
          clienteId: dados.id,
          parcelamentos: valores.parcelamentos,
        });
        if (!salvos.ok) {
          setErroServidor(
            `Os dados foram salvos, mas não foi possível salvar os Parcelamentos. ${salvos.error.message}`,
          );
          return;
        }
      }
      etapa = "atribuir o Responsável";

      if (podeAtribuirResponsavel && valores.responsavelId !== (dados.responsavelId ?? "")) {
        const atribuicao = await atribuirResponsavelAction({
          clienteId: dados.id,
          responsavelId: valores.responsavelId || null,
        });
        if (!atribuicao.ok) {
          // O cadastro já foi salvo; reenviar o formulário repete só a atribuição.
          setErroServidor(
            `Os dados foram salvos, mas não foi possível atribuir o Responsável. ${atribuicao.error.message}`,
          );
          return;
        }
      }

      setCadastroSalvo(null);
      setSucesso(true);
      if (aoSalvarComSucesso) {
        aoSalvarComSucesso();
      } else if (voltarHrefAoSalvar) {
        router.push(voltarHrefAoSalvar);
      }
    } catch {
      setErroServidor(
        cadastroPersistido
          ? `Os dados foram salvos, mas não foi possível ${etapa}. Verifique a conexão e tente novamente.`
          : "Não foi possível salvar agora. Verifique a conexão e tente novamente.",
      );
    } finally {
      setPendente(false);
    }
  });

  const aoLimpar = () => {
    reset(valoresIniciais);
    leitura.esquecerTodas();
    setErroServidor(undefined);
    setSucesso(false);
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
      erroServidor={erroServidor}
      sucesso={sucesso}
      oculto={!hidratado}
      contatos={fields}
      onAdicionarContato={() => append({ nome: "", telefone: "", padrao: fields.length === 0 })}
      onRemoverContato={remove}
      parcelamentoCampos={parcelamentoCampos.fields}
      onAdicionarParcelamento={() =>
        parcelamentoCampos.append({
          codigo: "",
          parcelasRestantes: 1,
          interno: false,
          quitado: false,
          temEnvio: false,
          enviadoNoMes: false,
          arquivoNome: "",
        })
      }
      onRemoverParcelamento={(indice) => {
        leitura.esquecer(parcelamentoCampos.fields[indice].id);
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
