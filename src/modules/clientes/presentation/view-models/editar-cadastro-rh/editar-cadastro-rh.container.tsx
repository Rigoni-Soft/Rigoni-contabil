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

import {
  contatoNovo,
  descartarLinhasEmBranco,
  reposicionarErros,
} from "../editar-cadastro-operacional/editar-cadastro-operacional.presenter";
import { DocumentoContratualDoClienteContainer } from "../visualizar-documento-contratual/documento-contratual-do-cliente.container";
import { editarCadastroRhAction } from "./editar-cadastro-rh.actions";
import { editarCadastroRhFormSchema } from "./editar-cadastro-rh.schema";

type Props = {
  dados: CadastroRhClienteDto | null;
  readOnly: boolean;
  // De onde a tela foi aberta: depois de salvar, volta para lá.
  voltarHref: string;
  documentosContratuais?: DocumentoContratualVisivelDto[];
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
  parcelamentos: [],
  observacoesGerais: dados.observacoes,
  atividadeMes: { industria: false, comercio: false, servico: false },
  responsavelId: "",
});

export function EditarCadastroRhContainer({
  dados,
  readOnly,
  voltarHref,
  documentosContratuais,
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
        },
      } as never;
    },
    defaultValues: valoresIniciais,
  });
  const { fields, append, remove } = useFieldArray({ control, name: "contatos" });

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
      setSucesso(true);
      router.push(voltarHref);
    } catch (erro) {
      console.error("Falha ao salvar o cadastro do RH", erro);
      setErroServidor(mensagemDaFalha(erro));
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
      onLimpar={() => {
        reset(valoresIniciais);
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
