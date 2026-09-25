"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { CriarUsuarioForm } from "@/presentation/components/organisms/criar-usuario-form.component";

import { criarUsuarioAction } from "./criar-usuario.actions";
import { criarUsuarioSchema, type CriarUsuarioFormValues } from "./criar-usuario.schema";

type ContaCriada = { nome: string; email: string; senhaProvisoria: string };

export function CriarUsuarioContainer() {
  const [pendente, setPendente] = useState(false);
  const [erroServidor, setErroServidor] = useState<string | undefined>();
  const [criado, setCriado] = useState<ContaCriada | undefined>();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CriarUsuarioFormValues>({ resolver: zodResolver(criarUsuarioSchema) });

  const aoSubmeter = handleSubmit(async (valores) => {
    setPendente(true);
    setErroServidor(undefined);

    const resultado = await criarUsuarioAction(valores);

    setPendente(false);
    if (!resultado.ok) {
      setErroServidor(resultado.error.message);
      return;
    }

    setCriado({
      nome: resultado.data.usuario.nome,
      email: resultado.data.usuario.email,
      senhaProvisoria: resultado.data.senhaProvisoria,
    });
  });

  return (
    <CriarUsuarioForm
      register={register}
      errors={errors}
      onSubmit={aoSubmeter}
      pendente={pendente}
      erroServidor={erroServidor}
      criado={criado}
    />
  );
}
