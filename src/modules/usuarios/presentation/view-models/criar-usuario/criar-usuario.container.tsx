"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { CriarUsuarioForm } from "@/presentation/components/organisms/criar-usuario-form.component";
import { opcaoUnica } from "@/shared/kernel/opcoes";
import type { PapelCadastravel } from "@/shared/kernel/papeis";

import { criarUsuarioAction } from "./criar-usuario.actions";
import { criarUsuarioSchema, type CriarUsuarioFormValues } from "./criar-usuario.schema";

type ContaCriada = { nome: string; email: string; senhaProvisoria: string };

type CriarUsuarioContainerProps = {
  papeisDisponiveis: PapelCadastravel[];
  setoresDisponiveis: string[];
};

export function CriarUsuarioContainer({
  papeisDisponiveis,
  setoresDisponiveis,
}: CriarUsuarioContainerProps) {
  const [pendente, setPendente] = useState(false);
  const [erroServidor, setErroServidor] = useState<string | undefined>();
  const [criado, setCriado] = useState<ContaCriada | undefined>();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CriarUsuarioFormValues>({ resolver: zodResolver(criarUsuarioSchema) });

  // Únicos valores possíveis quando só há 1 opção (Líder) — mesma regra do
  // formulário, pra "Cadastrar outro" devolver os campos travados corretos
  // em vez de limpá-los.
  const valorInicial: CriarUsuarioFormValues = {
    nome: "",
    email: "",
    papel: (opcaoUnica(papeisDisponiveis) ?? "") as CriarUsuarioFormValues["papel"],
    setor: (opcaoUnica(setoresDisponiveis) ?? "") as CriarUsuarioFormValues["setor"],
  };

  const aoCadastrarNovo = () => {
    setCriado(undefined);
    setErroServidor(undefined);
    reset(valorInicial);
  };

  const aoSubmeter = handleSubmit(async (valores) => {
    setPendente(true);
    setErroServidor(undefined);

    try {
      const resultado = await criarUsuarioAction(valores);
      if (!resultado.ok) {
        setErroServidor(resultado.error.message);
        return;
      }

      setCriado({
        nome: resultado.data.usuario.nome,
        email: resultado.data.usuario.email,
        senhaProvisoria: resultado.data.senhaProvisoria,
      });
    } catch {
      // Devolutiva técnica PR #61, ponto 5: sem isso, uma Promise rejeitada
      // (erro de rede/transporte) travava o botão em "Cadastrando..." pra
      // sempre, porque setPendente(false) só rodava depois do await. Mesma
      // rede de segurança já usada em login.container.tsx.
      setErroServidor("Falha inesperada. Tente novamente.");
    } finally {
      setPendente(false);
    }
  });

  return (
    <CriarUsuarioForm
      register={register}
      errors={errors}
      onSubmit={aoSubmeter}
      pendente={pendente}
      erroServidor={erroServidor}
      criado={criado}
      onCadastrarNovo={aoCadastrarNovo}
      papeisDisponiveis={papeisDisponiveis}
      setoresDisponiveis={setoresDisponiveis}
    />
  );
}
