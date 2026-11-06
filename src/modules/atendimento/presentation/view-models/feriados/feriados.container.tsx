"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { FeriadosAdmin } from "@/presentation/components/organisms/feriados-admin.component";

import { cadastrarFeriadoAction, removerFeriadoAction } from "./feriados.actions";
import { cadastrarFeriadoSchema, type CadastrarFeriadoFormValues } from "./feriados.schema";

type FeriadosContainerProps = { feriados: { data: string; descricao: string }[] };

export function FeriadosContainer({ feriados }: FeriadosContainerProps) {
  const router = useRouter();
  const [pendente, setPendente] = useState(false);
  const [erroServidor, setErroServidor] = useState<string | undefined>();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CadastrarFeriadoFormValues>({ resolver: zodResolver(cadastrarFeriadoSchema) });

  // Cadastrar e remover compartilham o ciclo: pendente, erro do servidor e recarga da lista.
  const executar = async (acao: () => Promise<{ ok: boolean; error?: { message: string } }>) => {
    setPendente(true);
    setErroServidor(undefined);
    try {
      const resultado = await acao();
      if (!resultado.ok) {
        setErroServidor(resultado.error?.message);
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setErroServidor("Falha inesperada. Tente novamente.");
      return false;
    } finally {
      setPendente(false);
    }
  };

  const aoSubmeter = handleSubmit(async (valores) => {
    if (await executar(() => cadastrarFeriadoAction(valores))) reset();
  });

  return (
    <FeriadosAdmin
      feriados={feriados}
      register={register}
      errors={errors}
      onSubmit={aoSubmeter}
      onRemover={(data) => void executar(() => removerFeriadoAction(data))}
      pendente={pendente}
      erroServidor={erroServidor}
    />
  );
}
