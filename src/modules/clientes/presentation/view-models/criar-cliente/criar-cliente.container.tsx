"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";

import { CriarClienteForm } from "@/presentation/components/organisms/criar-cliente-form.component";
import { mensagemDaFalha } from "@/presentation/lib/mensagem-da-falha";
import { normalizarCnpj } from "@/shared/kernel/cnpj";
import { outrosNumeros, sugerirNumero } from "@/shared/kernel/numero-alteracao";

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
  const [confirmandoLimpar, setConfirmandoLimpar] = useState(false);
  const { consultar: consultarCnpj } = useConsultarCnpj();

  const {
    register,
    control,
    handleSubmit,
    reset,
    getValues,
    setValue,
    setError,
    trigger,
    formState: { errors, isDirty },
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

  const aoLimpar = () => {
    setConfirmandoLimpar(false);
    setErroServidor(undefined);
    setAvisoCnpj(undefined);
    setAvisoRegime(undefined);
    reset();
  };

  const aoPedirLimpar = () => {
    if (isDirty) setConfirmandoLimpar(true);
    else aoLimpar();
  };

  const aoAdicionarAlteracao = () => {
    append({
      numero: undefined as unknown as number,
      data: "",
      arquivo: undefined as unknown as File,
    });
  };

  const aoEscolherArquivoDaAlteracao = (indice: number, arquivo: File | undefined) => {
    if (!arquivo) return;
    const campo = `alteracoesContratuais.${indice}.numero` as const;
    if (Number.isInteger(getValues(campo))) return;
    const outros = outrosNumeros(getValues("alteracoesContratuais"), indice).filter(
      Number.isInteger,
    );
    setValue(campo, sugerirNumero(arquivo.name, outros));
  };

  const aoDesfocarCnpj = async (cnpjMascarado: string) => {
    setAvisoCnpj(undefined);
    setAvisoRegime(undefined);

    const formatoValido = await trigger("cnpj");
    if (!formatoValido) return;

    const cnpj = normalizarCnpj(cnpjMascarado);
    const dados = await consultarCnpj(cnpj);
    if (normalizarCnpj(getValues("cnpj") ?? "") !== cnpj) return;

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

      if (!dados.regime) {
        setAvisoRegime(
          "Não foi possível confirmar o Regime automaticamente. Selecione manualmente.",
        );
        return;
      }
      if (!getValues("regime")) setValue("regime", dados.regime, { shouldValidate: true });
    }, 0);
  };

  const aoAlterarRegime = () => setAvisoRegime(undefined);
  const aoAlterarEmpresa = () => setAvisoCnpj(undefined);

  const aoSubmeter = handleSubmit(async (valores) => {
    setConfirmandoLimpar(false);
    setPendente(true);
    setErroServidor(undefined);

    try {
      const resultado = await criarClienteAction(valores);
      if (!resultado.ok) {
        setErroServidor(resultado.error.message);
        for (const [campo, mensagens] of Object.entries(resultado.error.fields ?? {})) {
          if (mensagens[0]) {
            setError(campo as keyof CriarClienteFormValues, { message: mensagens[0] });
          }
        }
        return;
      }
      setCriado({ empresa: resultado.data.cliente.empresa, cnpj: resultado.data.cliente.cnpj });
    } catch (erro) {
      console.error("Falha ao cadastrar o Cliente", erro);
      setErroServidor(mensagemDaFalha(erro));
    } finally {
      setPendente(false);
    }
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
      confirmandoLimpar={confirmandoLimpar}
      onPedirLimpar={aoPedirLimpar}
      onLimpar={aoLimpar}
      onCancelarLimpar={() => setConfirmandoLimpar(false)}
      alteracoes={fields}
      onAdicionarAlteracao={aoAdicionarAlteracao}
      onRemoverAlteracao={remove}
      onArquivoDaAlteracao={aoEscolherArquivoDaAlteracao}
      onCnpjBlur={aoDesfocarCnpj}
      avisoCnpj={avisoCnpj}
      avisoRegime={avisoRegime}
      onRegimeChange={aoAlterarRegime}
      onEmpresaChange={aoAlterarEmpresa}
    />
  );
}
