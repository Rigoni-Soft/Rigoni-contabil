"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";

import { CriarClienteForm } from "@/presentation/components/organisms/criar-cliente-form.component";

import { criarClienteAction } from "./criar-cliente.actions";
import { criarClienteSchema, type CriarClienteFormValues } from "./criar-cliente.schema";
import { useConsultarCnpj } from "./use-consultar-cnpj.hook";

type ClienteCriado = { empresa: string; cnpj: string };

export function CriarClienteContainer() {
  const [pendente, setPendente] = useState(false);
  const [erroServidor, setErroServidor] = useState<string | undefined>();
  const [criado, setCriado] = useState<ClienteCriado | undefined>();
  const [avisoCnpj, setAvisoCnpj] = useState<string | undefined>();
  const [avisoRegime, setAvisoRegime] = useState<string | undefined>();
  const { consultar: consultarCnpj } = useConsultarCnpj();

  const {
    register,
    control,
    handleSubmit,
    reset,
    getValues,
    setValue,
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

  // Autopreenche Empresa/Regime via API pública ao sair do campo CNPJ, sem
  // sobrescrever o que o Admin já tiver digitado à mão (ponto 4 do feedback
  // manual, 2026-09-29). Avisa e libera preenchimento manual quando o CNPJ
  // não é encontrado, ou quando é encontrado mas o Regime não dá pra
  // confirmar automaticamente (feedback manual, 2026-09-29).
  const aoDesfocarCnpj = async (cnpjMascarado: string) => {
    setAvisoCnpj(undefined);
    setAvisoRegime(undefined);

    const digitos = cnpjMascarado.replace(/\D/g, "");
    const dados = await consultarCnpj(digitos);

    // setTimeout: nunca deixa esses setState caírem no mesmo lote de render
    // de uma ação síncrona concorrente (ex.: clicar "Adicionar" bem quando a
    // resposta chega) — mesma causa raiz do bug de corrida com
    // useFieldArray.append() já corrigido nesta tela (ver use-consultar-cnpj.hook.ts).
    setTimeout(() => {
      if (!dados) {
        setAvisoCnpj(
          "CNPJ não encontrado. Confirme a numeração ou preencha Empresa e Regime manualmente.",
        );
        return;
      }

      if (dados.empresa && !getValues("empresa")) {
        setValue("empresa", dados.empresa, { shouldValidate: true });
      }

      if (dados.regime) {
        if (!getValues("regime")) setValue("regime", dados.regime, { shouldValidate: true });
      } else {
        setAvisoRegime(
          "Não foi possível confirmar o Regime automaticamente. Selecione manualmente.",
        );
      }
    }, 0);
  };

  const aoAlterarRegime = () => setAvisoRegime(undefined);

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
      onCnpjBlur={aoDesfocarCnpj}
      avisoCnpj={avisoCnpj}
      avisoRegime={avisoRegime}
      onRegimeChange={aoAlterarRegime}
    />
  );
}
