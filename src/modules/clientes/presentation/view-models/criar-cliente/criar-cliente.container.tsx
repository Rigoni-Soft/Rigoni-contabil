"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";

import { CriarClienteForm } from "@/presentation/components/organisms/criar-cliente-form.component";
import { normalizarCnpj } from "@/shared/kernel/cnpj";
import { outrosNumeros, sugerirNumero } from "@/shared/kernel/numero-alteracao";

import { criarClienteAction } from "./criar-cliente.actions";
import { criarClienteSchema, type CriarClienteFormValues } from "./criar-cliente.schema";
import { useConsultarCnpj } from "./use-consultar-cnpj.hook";

type ClienteCriado = { empresa: string; cnpj: string };

// A Server Action rejeitou em vez de devolver um erro de domínio: diz qual das causas é, em vez de
// culpar sempre a conexão. Só `TypeError` (fetch que não saiu) é de rede; arquivo que o navegador
// não consegue ler (alterado ou ainda só na nuvem do OneDrive) é `NotReadableError`.
function mensagemDaFalha(erro: unknown): string {
  if (erro instanceof TypeError) {
    return "Sem conexão com o servidor. Verifique a internet e tente novamente.";
  }
  if (erro instanceof DOMException && erro.name === "NotReadableError") {
    return "Não foi possível ler um dos arquivos. Copie-o para outra pasta (fora do OneDrive), escolha de novo e tente novamente.";
  }
  return "Erro inesperado no servidor ao cadastrar. Tente novamente; se continuar, avise o suporte.";
}

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

  // Zera tudo, inclusive o que não é campo: erro do servidor e avisos da consulta de CNPJ.
  const aoLimpar = () => {
    setConfirmandoLimpar(false);
    setErroServidor(undefined);
    setAvisoCnpj(undefined);
    setAvisoRegime(undefined);
    reset();
  };

  // Formulário em branco limpa direto; com algo preenchido (campo ou alteração), pede confirmação,
  // porque o clique descarta arquivos escolhidos e não dá para desfazer.
  const aoPedirLimpar = () => {
    if (isDirty || fields.length > 0) setConfirmandoLimpar(true);
    else aoLimpar();
  };

  const aoAdicionarAlteracao = () => {
    // arquivo começa vazio (usuário ainda não escolheu); a validação de "obrigatório"
    // acontece no submit, mesmo padrão do contrato social.
    append({
      numero: undefined as unknown as number,
      data: "",
      arquivo: undefined as unknown as File,
    });
  };

  // Sugere o nº pelo prefixo do arquivo (ou maior nº + 1), só com o campo vazio: nunca pisa no que
  // o Admin digitou.
  const aoEscolherArquivoDaAlteracao = (indice: number, arquivo: File | undefined) => {
    if (!arquivo) return;
    const campo = `alteracoesContratuais.${indice}.numero` as const;
    if (Number.isInteger(getValues(campo))) return;
    const outros = outrosNumeros(getValues("alteracoesContratuais"), indice).filter(
      Number.isInteger,
    );
    setValue(campo, sugerirNumero(arquivo.name, outros));
  };

  // Autopreenche Empresa/Regime via API pública ao sair do campo CNPJ, sem sobrescrever o que o
  // Admin já tiver digitado à mão. Avisa e libera preenchimento manual quando o CNPJ não é
  // encontrado, ou quando é encontrado mas o Regime não dá pra confirmar automaticamente.
  const aoDesfocarCnpj = async (cnpjMascarado: string) => {
    setAvisoCnpj(undefined);
    setAvisoRegime(undefined);

    // Formato inválido (dígito verificador não bate) não faz sentido consultar
    // a API pública — "não encontrado" seria enganoso pra um CNPJ que nem é
    // válido. `trigger` roda o schema (inclui o refine de dígito verificador)
    // e já preenche `errors.cnpj` com "CNPJ inválido" quando falha.
    const formatoValido = await trigger("cnpj");
    if (!formatoValido) return;

    const cnpj = normalizarCnpj(cnpjMascarado);
    const dados = await consultarCnpj(cnpj);
    // Resposta obsoleta: o Admin já trocou o CNPJ enquanto a consulta voava. Aplicar Empresa/Regime
    // de outro CNPJ seria preencher o formulário com dados que não são desse cadastro. Após
    // `reset()` ("Cadastrar outro") o valor volta a `undefined`: tratado como CNPJ trocado.
    if (normalizarCnpj(getValues("cnpj") ?? "") !== cnpj) return;

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

    // try/finally: rejeição de transporte da Server Action não pode deixar o
    // botão preso em "Cadastrando...".
    try {
      const resultado = await criarClienteAction(valores);
      if (!resultado.ok) {
        setErroServidor(resultado.error.message);
        // Erro de validação do domínio aponta pro campo certo, não só um aviso
        // genérico no rodapé.
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
