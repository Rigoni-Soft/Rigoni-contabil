import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import type { DocumentoContratualVisivelDto } from "@/modules/clientes/application/ports/in/documentos-contratuais-cliente.provider";

import { chaveDocumentosContratuais } from "../visualizar-documento-contratual/documentos-contratuais.queries";
import { anexarAlteracaoContratualAction } from "./anexar-alteracao-contratual.actions";
import {
  avisoDeDivergencia,
  erroDeNumeroRepetido,
  numeroSugerido,
} from "./anexar-alteracao-contratual.presenter";
import { anexarAlteracaoContratualSchema } from "./anexar-alteracao-contratual.schema";

const formSchema = anexarAlteracaoContratualSchema.omit({ clienteId: true });
export type AnexarAlteracaoFormValues = z.infer<typeof formSchema>;

const ERRO_TRANSPORTE = "Não foi possível anexar agora. Verifique a conexão e tente novamente.";

export function useAnexarAlteracaoContratual(
  clienteId: string,
  documentos: DocumentoContratualVisivelDto[],
  painelId: string,
) {
  const queryClient = useQueryClient();
  const [pendente, setPendente] = useState(false);
  const [erroServidor, setErroServidor] = useState<string | undefined>();
  // Confirmação que sobrevive ao fechamento do diálogo: quem anexou precisa ouvir/ver que deu certo.
  const [sucesso, setSucesso] = useState<string | undefined>();
  const {
    register,
    control,
    handleSubmit,
    reset,
    getValues,
    setValue,
    setError,
    trigger,
    formState: { errors },
  } = useForm<AnexarAlteracaoFormValues>({ resolver: zodResolver(formSchema) });
  const [numero, data] = useWatch({ control, name: ["numero", "data"] });

  // Sugere o nº só com o campo vazio: nunca pisa no que o Admin digitou.
  const sugerirNumeroDoArquivo = (arquivo: File | undefined) => {
    if (!arquivo || Number.isInteger(getValues("numero"))) return;
    setValue("numero", numeroSugerido(arquivo.name, documentos));
  };

  // Arquivo grande ou de outro tipo é recusado já na escolha, não só ao enviar.
  const aoEscolherArquivo = (arquivo: File | undefined) => {
    sugerirNumeroDoArquivo(arquivo);
    if (arquivo) void trigger("arquivo");
  };

  // Fechar (Esc, fora, X) descarta o rascunho e o erro: reabrir começa limpo.
  const aoFechar = () => {
    reset();
    setErroServidor(undefined);
  };

  const onSubmit = handleSubmit(async (valores) => {
    // Antes de subir o arquivo: a lista carregada já recusa o nº repetido.
    const repetido = erroDeNumeroRepetido(valores.numero, documentos);
    if (repetido) {
      setError("numero", { message: repetido });
      return;
    }
    setPendente(true);
    setErroServidor(undefined);
    setSucesso(undefined);
    try {
      const resultado = await anexarAlteracaoContratualAction({ clienteId, ...valores });
      if (!resultado.ok) {
        setErroServidor(resultado.error.message);
        for (const [campo, mensagens] of Object.entries(resultado.error.fields ?? {})) {
          if (mensagens[0]) {
            setError(campo as keyof AnexarAlteracaoFormValues, { message: mensagens[0] });
          }
        }
        return;
      }
      await queryClient.invalidateQueries({ queryKey: chaveDocumentosContratuais(clienteId) });
      setSucesso(`Alteração nº ${valores.numero} anexada.`);
      reset();
      document.getElementById(painelId)?.hidePopover();
    } catch {
      setErroServidor(ERRO_TRANSPORTE);
    } finally {
      setPendente(false);
    }
  });

  return {
    register,
    control,
    errors,
    onSubmit,
    pendente,
    erroServidor,
    sucesso,
    aoFechar,
    aviso: avisoDeDivergencia(numero, data ?? "", documentos) ?? undefined,
    aoEscolherArquivo,
  };
}
