import { useState } from "react";

import type { DocumentoContratualVisivelDto } from "@/modules/clientes/application/ports/in/documentos-contratuais-cliente.provider";

import { chaveDoDocumento } from "./documentos-contratuais.presenter";
import { obterLinkDocumentoContratualAction } from "./visualizar-documento-contratual.actions";

const ERRO_ABRIR = "Não foi possível abrir o documento. Tente novamente.";
const ERRO_ABA_BLOQUEADA =
  "O navegador bloqueou a nova aba. Use o link abaixo, que expira em poucos minutos.";

// `documentos` já vem do mais recente (maior nº) para o contrato social: o primeiro é o destaque.
export function useVisualizarDocumentoContratual(
  clienteId: string,
  documentos: DocumentoContratualVisivelDto[],
) {
  const [chave, setChave] = useState(() => chaveDoDocumento(documentos[0]));
  const [abrindo, setAbrindo] = useState(false);
  // `link` só existe quando o navegador barra a nova aba: o link já gerado vira clicável no diálogo.
  const [aviso, setAviso] = useState<{ erro: string; link?: string }>();

  const selecionado = documentos.find((d) => chaveDoDocumento(d) === chave) ?? documentos[0];

  const abrir = async () => {
    setAbrindo(true);
    setAviso(undefined);
    // A aba abre de forma síncrona no clique (senão o bloqueador de pop-up barra) e recebe o link
    // depois que a Server Action devolve; sem `noopener` para guardar a referência, `opener` é zerado.
    const aba = window.open("about:blank", "_blank");
    if (aba) aba.opener = null;
    try {
      const resultado = await obterLinkDocumentoContratualAction({
        clienteId,
        tipo: selecionado.tipo,
        numero: selecionado.numero,
      });
      if (resultado.ok && aba) {
        aba.location.href = resultado.data.url;
        return;
      }
      aba?.close();
      if (resultado.ok) {
        setAviso({ erro: ERRO_ABA_BLOQUEADA, link: resultado.data.url });
        return;
      }
      setAviso({ erro: resultado.error.message });
    } catch {
      aba?.close();
      setAviso({ erro: ERRO_ABRIR });
    } finally {
      setAbrindo(false);
    }
  };

  // Trocar de documento descarta o erro e o link do anterior.
  const selecionar = (nova: string) => {
    setChave(nova);
    setAviso(undefined);
  };

  return {
    selecionado,
    selecionar,
    abrir,
    abrindo,
    erro: aviso?.erro,
    linkAlternativo: aviso?.link,
  };
}
