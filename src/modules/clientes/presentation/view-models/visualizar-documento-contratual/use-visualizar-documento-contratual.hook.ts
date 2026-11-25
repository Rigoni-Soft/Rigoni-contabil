import { useState } from "react";

import { abrirEmNovaAba } from "@/presentation/lib/abrir-em-nova-aba";
import type { DocumentoContratualVisivelDto } from "@/modules/clientes/application/ports/in/documentos-contratuais-cliente.provider";

import { documentoEmDestaque } from "./documentos-contratuais.presenter";
import { obterLinkDocumentoContratualAction } from "./visualizar-documento-contratual.actions";

const ERRO_ABRIR = "Não foi possível abrir o documento. Tente novamente.";
const ERRO_ABA_BLOQUEADA =
  "O navegador bloqueou a nova aba. Use o link abaixo, que expira em poucos minutos.";

export function useVisualizarDocumentoContratual(
  clienteId: string,
  documentos: DocumentoContratualVisivelDto[],
  alteracaoEmFoco?: number,
) {
  const [abrindo, setAbrindo] = useState(false);
  const [aviso, setAviso] = useState<{ erro: string; link?: string }>();

  const documento = documentoEmDestaque(documentos, alteracaoEmFoco);

  const abrir = async () => {
    setAbrindo(true);
    setAviso(undefined);
    try {
      const aba = await abrirEmNovaAba(() =>
        obterLinkDocumentoContratualAction({
          clienteId,
          tipo: documento.tipo,
          numero: documento.numero,
        }),
      );
      if (aba.tipo === "bloqueada") setAviso({ erro: ERRO_ABA_BLOQUEADA, link: aba.url });
      if (aba.tipo === "erro") setAviso({ erro: aba.mensagem });
    } catch {
      setAviso({ erro: ERRO_ABRIR });
    } finally {
      setAbrindo(false);
    }
  };

  return { documento, abrir, abrindo, erro: aviso?.erro, linkAlternativo: aviso?.link };
}
