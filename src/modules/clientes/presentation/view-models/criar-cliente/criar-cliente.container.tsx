"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";

import { CriarClienteForm } from "@/presentation/components/organisms/criar-cliente-form.component";

import { criarClienteAction } from "./criar-cliente.actions";
import { criarClienteSchema, type CriarClienteFormValues } from "./criar-cliente.schema";

type ClienteCriado = { empresa: string; cnpj: string };

export function CriarClienteContainer() {
  const [pendente, setPendente] = useState(false);
  const [erroServidor, setErroServidor] = useState<string | undefined>();
  const [criado, setCriado] = useState<ClienteCriado | undefined>();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CriarClienteFormValues>({
    resolver: zodResolver(criarClienteSchema),
    defaultValues: { alteracoesContratuais: [] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "alteracoesContratuais" });

  const aoCadastrarNovo = () => {
    setCriado(undefined);
    setErroServidor(undefined);
    reset();
  };

  const aoAdicionarAlteracao = () => {
    // arquivo começa vazio (usuário ainda não escolheu); a validação de "obrigatório"
    // acontece no submit, mesmo padrão do contrato social.
    append({ data: "", arquivo: undefined as unknown as File });
  };

  const aoSubmeter = handleSubmit(async (valores) => {
    setPendente(true);
    setErroServidor(undefined);

    const resultado = await criarClienteAction(valores);

    setPendente(false);
    if (!resultado.ok) {
      setErroServidor(resultado.error.message);
      return;
    }

    setCriado({ empresa: resultado.data.cliente.empresa, cnpj: resultado.data.cliente.cnpj });
  });

  return (
    <CriarClienteForm
      register={register}
      control={control}
      errors={errors}
      onSubmit={aoSubmeter}
      pendente={pendente}
      erroServidor={erroServidor}
      criado={criado}
      onCadastrarNovo={aoCadastrarNovo}
      alteracoes={fields}
      onAdicionarAlteracao={aoAdicionarAlteracao}
      onRemoverAlteracao={remove}
    />
  );
}
