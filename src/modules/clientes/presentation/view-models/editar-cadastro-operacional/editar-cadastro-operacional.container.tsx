"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch } from "react-hook-form";

import { Texto } from "@/presentation/components/atoms/texto.component";
import {
  EditarCadastroOperacionalForm,
  type EditarCadastroOperacionalFormValues,
} from "@/presentation/components/organisms/editar-cadastro-operacional-form.component";
import type { CadastroOperacionalClienteDto } from "@/modules/clientes/application/ports/out/cliente-query.provider";
import { REGIME_LABEL, regimeTemCadastroOperacionalSn } from "@/shared/kernel/regimes";

import { atribuirResponsavelAction } from "./atribuir-responsavel.actions";
import { editarCadastroOperacionalAction } from "./editar-cadastro-operacional.actions";
import { nomeResponsavelAtual, opcoesResponsavel } from "./editar-cadastro-operacional.presenter";
import { editarCadastroOperacionalFormSchema } from "./editar-cadastro-operacional.schema";
import { useResponsaveisElegiveis } from "./responsaveis.queries";

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
};

export function EditarCadastroOperacionalContainer({
  dados,
  readOnly,
  podeAtribuirResponsavel = false,
  onCancelar,
  aoSalvarComSucesso,
  voltarHrefAoSalvar,
}: Props) {
  const router = useRouter();
  const [pendente, setPendente] = useState(false);
  const [erroServidor, setErroServidor] = useState<string | undefined>();
  const [sucesso, setSucesso] = useState(false);
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
        temParcelamento: dados.temParcelamento,
        parcelamentoStatus:
          dados.parcelamentoStatus as EditarCadastroOperacionalFormValues["parcelamentoStatus"],
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
    setError,
    formState: { errors },
  } = useForm<EditarCadastroOperacionalFormValues>({
    resolver: zodResolver(editarCadastroOperacionalFormSchema),
    defaultValues: valoresIniciais,
  });

  const temParcelamento = useWatch({
    control,
    name: "temParcelamento",
    defaultValue: dados?.temParcelamento ?? false,
  });
  // Lista de Funcionários só é buscada quando o Líder abre o Select.
  const [listaAberta, setListaAberta] = useState(false);
  const elegiveis = useResponsaveisElegiveis(podeAtribuirResponsavel && listaAberta);
  const { fields, append, remove } = useFieldArray({ control, name: "contatos" });

  const aoSubmeter = handleSubmit(async (valores) => {
    if (!dados) return;
    setPendente(true);
    setErroServidor(undefined);
    setSucesso(false);

    // Vira true quando o cadastro está persistido (nesta tentativa ou numa anterior): a mensagem
    // de erro de transporte precisa dizer isso em vez de sugerir que nada foi salvo.
    let cadastroPersistido = false;
    // try/finally: rejeição de transporte da Server Action não pode deixar o
    // botão preso em "Salvando...".
    try {
      const { responsavelId: _responsavelId, ...cadastro } = valores;
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
          ? "Os dados foram salvos, mas não foi possível atribuir o Responsável. Verifique a conexão e tente novamente."
          : "Não foi possível salvar agora. Verifique a conexão e tente novamente.",
      );
    } finally {
      setPendente(false);
    }
  });

  const aoLimpar = () => {
    reset(valoresIniciais);
    setErroServidor(undefined);
    setSucesso(false);
  };

  if (!dados) {
    return <Texto variante="apoio">Cliente não encontrado.</Texto>;
  }

  if (!regimeTemCadastroOperacionalSn(dados.regime)) {
    return (
      <Texto variante="apoio" role="status">
        O Cadastro operacional do Simples Nacional não se aplica ao Regime{" "}
        {REGIME_LABEL[dados.regime] ?? dados.regime}.
      </Texto>
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
      temParcelamento={temParcelamento}
      dasEnviadoPeloSistema={dados?.dasStatus === "enviado"}
      erroServidor={erroServidor}
      sucesso={sucesso}
      contatos={fields}
      onAdicionarContato={() => append({ nome: "", telefone: "", padrao: fields.length === 0 })}
      onRemoverContato={remove}
      onLimpar={aoLimpar}
      onCancelar={onCancelar}
    />
  );
}
