"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";

import { Texto } from "@/presentation/components/atoms/texto.component";
import type { EditarCadastroOperacionalFormValues } from "@/presentation/components/organisms/editar-cadastro-operacional-form.component";
import { EditarCadastroRhForm } from "@/presentation/components/organisms/editar-cadastro-rh-form.component";
import { mensagemDaFalha } from "@/presentation/lib/mensagem-da-falha";
import type { DocumentoContratualVisivelDto } from "@/modules/clientes/application/ports/in/documentos-contratuais-cliente.provider";
import type { CadastroRhClienteDto } from "@/modules/clientes/application/ports/out/cliente-query.provider";

import { AnexarGuiaParcelaPgfnContainer } from "../anexar-guia-parcela-pgfn/anexar-guia-parcela-pgfn.container";
import {
  contatoNovo,
  descartarLinhasEmBranco,
  leituraDaLinha,
  parcelamentoNovo,
  reposicionarErros,
  resumoDoAcordo,
} from "../editar-cadastro-operacional/editar-cadastro-operacional.presenter";
import {
  FalhaDeEtapa,
  salvarParcelamentosDoSetor,
} from "../editar-cadastro-operacional/salvar-parcelamentos-do-setor.presenter";
import { useLeituraDoPdf } from "../editar-cadastro-operacional/use-leitura-do-pdf.hook";
import { DocumentoContratualDoClienteContainer } from "../visualizar-documento-contratual/documento-contratual-do-cliente.container";
import { editarCadastroRhAction } from "./editar-cadastro-rh.actions";
import { editarCadastroRhFormSchema } from "./editar-cadastro-rh.schema";

type Props = {
  dados: CadastroRhClienteDto | null;
  readOnly: boolean;
  // De onde a tela foi aberta: depois de salvar, volta para lá.
  voltarHref: string;
  documentosContratuais?: DocumentoContratualVisivelDto[];
  // Montados no servidor e encaixados no cartão: o Responsável do RH e o acompanhamento do mês.
  responsavel?: React.ReactNode;
  mesDoAcompanhamento?: React.ReactNode;
  acompanhamento?: React.ReactNode;
};

type Valores = EditarCadastroOperacionalFormValues;

// O formulário reaproveita os campos do formulário do SN (contatos e observações gerais); os do SN ficam
// com o valor neutro e nunca são enviados.
const valoresIniciaisDe = (dados: CadastroRhClienteDto, readOnly: boolean): Valores => ({
  formaEnvio: "whatsapp",
  contatos: dados.contatos.length || readOnly ? dados.contatos : [contatoNovo(true)],
  documentoObrigatorio: null,
  dasStatus: null,
  dataEnvioDas: null,
  parcelamentos:
    dados.parcelamentos.length || readOnly ? dados.parcelamentos : [parcelamentoNovo()],
  observacoesGerais: dados.observacoes,
  atividadeMes: { industria: false, comercio: false, servico: false },
  responsavelId: "",
});

export function EditarCadastroRhContainer({
  dados,
  readOnly,
  voltarHref,
  documentosContratuais,
  responsavel,
  mesDoAcompanhamento,
  acompanhamento,
}: Props) {
  const router = useRouter();
  const hidratado = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const [pendente, setPendente] = useState(false);
  const [erroServidor, setErroServidor] = useState<string>();
  const [sucesso, setSucesso] = useState(false);

  const valoresIniciais = dados ? valoresIniciaisDe(dados, readOnly) : undefined;
  const {
    register,
    control,
    handleSubmit,
    reset,
    getValues,
    setValue,
    setError,
    formState: { errors },
  } = useForm<Valores>({
    // Valida sem as linhas de contato em branco, como o formulário do SN.
    resolver: async (valores, contexto, opcoes) => {
      const semBranco = descartarLinhasEmBranco(valores);
      // O schema só conhece os campos do RH; os do SN (neutros) ficam de fora, daí os `never`.
      const resultado = await zodResolver(editarCadastroRhFormSchema)(
        semBranco.valores as never,
        contexto as never,
        opcoes as never,
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
      } as never;
    },
    defaultValues: valoresIniciais,
  });
  const { fields, append, remove } = useFieldArray({ control, name: "contatos" });
  const parcelamentoCampos = useFieldArray({ control, name: "parcelamentos" });
  const leitura = useLeituraDoPdf(dados?.id ?? "", setValue, parcelamentoCampos.fields);

  if (!dados) return <Texto variante="apoio">Cliente não encontrado.</Texto>;

  const salvar = async (valores: Valores) => {
    setPendente(true);
    setErroServidor(undefined);
    setSucesso(false);
    try {
      const { contatos } = descartarLinhasEmBranco(getValues()).valores;
      const resultado = await editarCadastroRhAction({
        clienteId: dados.id,
        observacoes: valores.observacoesGerais,
        contatos,
      });
      if (!resultado.ok) {
        setErroServidor(resultado.error.message);
        for (const [campo, mensagens] of Object.entries(resultado.error.fields ?? {})) {
          // O formulário chama de `observacoesGerais` o que a action chama de `observacoes`.
          const nome = campo === "observacoes" ? "observacoesGerais" : campo;
          if (mensagens[0]) setError(nome as keyof Valores, { message: mensagens[0] });
        }
        return;
      }
      // Os Parcelamentos têm PDF: vão por Server Action própria, depois do cadastro.
      const erroParcelamentos = await salvarParcelamentosDoSetor({
        clienteId: dados.id,
        setor: "rh",
        salvos: dados.parcelamentos,
        valores,
        getValues,
        setValue,
      });
      if (erroParcelamentos) {
        setErroServidor(erroParcelamentos);
        return;
      }
      setSucesso(true);
      router.push(voltarHref);
    } catch (erro) {
      console.error("Falha ao salvar o cadastro do RH", erro);
      setErroServidor(
        erro instanceof FalhaDeEtapa && erro.etapa
          ? `Os dados foram salvos, mas não foi possível ${erro.etapa}. Verifique a conexão e tente novamente.`
          : mensagemDaFalha(erro),
      );
    } finally {
      setPendente(false);
    }
  };

  return (
    <EditarCadastroRhForm
      cabecalho={{ empresa: dados.empresa, cnpj: dados.cnpj }}
      register={register}
      control={control}
      errors={errors}
      onSubmit={handleSubmit(salvar)}
      pendente={pendente}
      readOnly={readOnly}
      erroServidor={erroServidor}
      sucesso={sucesso}
      oculto={!hidratado}
      contatos={fields}
      onAdicionarContato={() => append(contatoNovo(fields.length === 0))}
      onRemoverContato={remove}
      // Lido no render: o que a tela exibe (resumo, selo, nome do PDF) só muda quando uma linha entra ou sai.
      parcelamentos={(getValues("parcelamentos") ?? dados.parcelamentos).map((p) => ({
        ...p,
        acordoResumo: resumoDoAcordo(p.acordo),
      }))}
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
      guiasDaParcela={(parcelamentoId, codigo, interno) => (
        <AnexarGuiaParcelaPgfnContainer
          parcelamentoId={parcelamentoId}
          codigo={codigo}
          interno={interno}
        />
      )}
      responsavel={responsavel}
      mesDoAcompanhamento={mesDoAcompanhamento}
      acompanhamento={acompanhamento}
      onLimpar={() => {
        reset(valoresIniciais);
        leitura.esquecerTodas();
        setErroServidor(undefined);
        setSucesso(false);
      }}
      documentoContratual={
        <DocumentoContratualDoClienteContainer
          clienteId={dados.id}
          documentosIniciais={documentosContratuais}
          podeAnexar={false}
        />
      }
    />
  );
}
