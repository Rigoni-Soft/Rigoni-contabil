import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import type { DocumentoContratualVisivelDto } from "@/modules/clientes/application/ports/in/documentos-contratuais-cliente.provider";
import { erroDeDuplicidade, sugerirNumero } from "@/shared/kernel/numero-alteracao";

import { chaveDocumentosContratuais } from "../visualizar-documento-contratual/documentos-contratuais.queries";
import { anexarAlteracaoContratualAction } from "./anexar-alteracao-contratual.actions";
import { alteracoesDaLista, avisoDeDivergencia } from "./anexar-alteracao-contratual.presenter";
import { anexarAlteracaoContratualSchema } from "./anexar-alteracao-contratual.schema";

const formSchema = anexarAlteracaoContratualSchema.omit({ clienteId: true });
type AnexarAlteracaoFormValues = z.infer<typeof formSchema>;

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
  const numeros = alteracoesDaLista(documentos).map((a) => a.numero);

  // Sugere o nº só com o campo vazio (nunca pisa no que o Admin digitou) e já valida o arquivo:
  // grande demais ou de outro tipo é recusado na escolha, não só ao enviar.
  const aoEscolherArquivo = (arquivo: File | undefined) => {
    if (!arquivo) return;
    if (!Number.isInteger(getValues("numero"))) {
      setValue("numero", sugerirNumero(arquivo.name, numeros));
    }
    void trigger("arquivo");
  };

  // Fechar (Esc, fora, X) descarta o rascunho e o erro: reabrir começa limpo.
  const aoFechar = () => {
    reset();
    setErroServidor(undefined);
  };

  const onSubmit = handleSubmit(async (valores) => {
    // Antes de subir o arquivo: a lista carregada já recusa o nº repetido.
    const repetido = erroDeDuplicidade(valores.numero, numeros);
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
    aviso: avisoDeDivergencia(numero, data ?? "", documentos),
    aoEscolherArquivo,
  };
}
