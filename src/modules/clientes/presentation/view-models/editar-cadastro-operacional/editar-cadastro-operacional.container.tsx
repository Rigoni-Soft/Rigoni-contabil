"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch } from "react-hook-form";

import {
  EditarCadastroOperacionalForm,
  type EditarCadastroOperacionalFormValues,
} from "@/presentation/components/organisms/editar-cadastro-operacional-form.component";
import type { CadastroOperacionalClienteDto } from "@/modules/clientes/application/ports/out/cliente-query.provider";

import { editarCadastroOperacionalAction } from "./editar-cadastro-operacional.actions";
import { editarCadastroOperacionalFormSchema } from "./editar-cadastro-operacional.schema";

type Props = {
  dados: CadastroOperacionalClienteDto | null;
  readOnly: boolean;
};

export function EditarCadastroOperacionalContainer({ dados, readOnly }: Props) {
  const [pendente, setPendente] = useState(false);
  const [erroServidor, setErroServidor] = useState<string | undefined>();
  const [sucesso, setSucesso] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<EditarCadastroOperacionalFormValues>({
    resolver: zodResolver(editarCadastroOperacionalFormSchema),
    defaultValues: dados
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
        }
      : undefined,
  });

  const temParcelamento = useWatch({
    control,
    name: "temParcelamento",
    defaultValue: dados?.temParcelamento ?? false,
  });
  const { fields, append, remove } = useFieldArray({ control, name: "contatos" });

  const aoSubmeter = handleSubmit(async (valores) => {
    if (!dados) return;
    setPendente(true);
    setErroServidor(undefined);
    setSucesso(false);

    const resultado = await editarCadastroOperacionalAction({ ...valores, clienteId: dados.id });

    setPendente(false);
    if (!resultado.ok) {
      setErroServidor(resultado.error.message);
      for (const [campo, mensagens] of Object.entries(resultado.error.fields ?? {})) {
        if (mensagens[0] && campo !== "clienteId") {
          setError(campo as keyof EditarCadastroOperacionalFormValues, { message: mensagens[0] });
        }
      }
      return;
    }

    setSucesso(true);
  });

  if (!dados) {
    return <p className="text-sm text-muted-foreground">Cliente não encontrado.</p>;
  }

  return (
    <EditarCadastroOperacionalForm
      cabecalho={{ empresa: dados.empresa, cnpj: dados.cnpj, regime: dados.regime }}
      register={register}
      errors={errors}
      onSubmit={aoSubmeter}
      pendente={pendente}
      readOnly={readOnly}
      temParcelamento={temParcelamento}
      erroServidor={erroServidor}
      sucesso={sucesso}
      contatos={fields}
      onAdicionarContato={() => append({ nome: "", telefone: "", padrao: fields.length === 0 })}
      onRemoverContato={remove}
    />
  );
}
