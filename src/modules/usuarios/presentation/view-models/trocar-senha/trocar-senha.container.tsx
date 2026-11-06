"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { TrocarSenhaForm } from "@/presentation/components/organisms/trocar-senha-form.component";

import { trocarSenhaAction } from "./trocar-senha.actions";
import { trocarSenhaSchema, type TrocarSenhaFormValues } from "./trocar-senha.schema";

export function TrocarSenhaContainer() {
  const router = useRouter();
  const [pendente, setPendente] = useState(false);
  const [erroServidor, setErroServidor] = useState<string | undefined>();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TrocarSenhaFormValues>({ resolver: zodResolver(trocarSenhaSchema) });

  const aoSubmeter = handleSubmit(async (valores) => {
    setPendente(true);
    setErroServidor(undefined);

    try {
      const resultado = await trocarSenhaAction(valores);
      if (!resultado.ok) {
        setErroServidor(resultado.error.message);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setErroServidor("Falha inesperada. Tente novamente.");
    } finally {
      setPendente(false);
    }
  });

  return (
    <TrocarSenhaForm
      register={register}
      errors={errors}
      onSubmit={aoSubmeter}
      pendente={pendente}
      erroServidor={erroServidor}
    />
  );
}
