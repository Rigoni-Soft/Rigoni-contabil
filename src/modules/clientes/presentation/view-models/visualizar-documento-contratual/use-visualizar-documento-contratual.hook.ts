import { useState } from "react";

import { chaveDoDocumento, type DocumentoVisivel } from "./documentos-contratuais.presenter";
import { obterLinkDocumentoContratualAction } from "./visualizar-documento-contratual.actions";

const ERRO_ABRIR = "Não foi possível abrir o documento. Tente novamente.";
const ERRO_ABA_BLOQUEADA =
  "O navegador bloqueou a nova aba. Use o link abaixo, que vale 120 segundos.";

// `documentos` já vem do mais recente (maior nº) para o contrato social: o primeiro é o destaque.
export function useVisualizarDocumentoContratual(
  clienteId: string,
  documentos: DocumentoVisivel[],
) {
  const [chave, setChave] = useState(() => chaveDoDocumento(documentos[0]));
  const [abrindo, setAbrindo] = useState(false);
  const [erro, setErro] = useState<string | undefined>();
  // Só quando o navegador barra a nova aba: o link já gerado vira um link clicável no diálogo.
  const [linkAlternativo, setLinkAlternativo] = useState<string | undefined>();

  const selecionado = documentos.find((d) => chaveDoDocumento(d) === chave) ?? documentos[0];

  const abrir = async () => {
    setAbrindo(true);
    setErro(undefined);
    setLinkAlternativo(undefined);
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
        setLinkAlternativo(resultado.data.url);
        setErro(ERRO_ABA_BLOQUEADA);
        return;
      }
      setErro(resultado.error.message);
    } catch {
      aba?.close();
      setErro(ERRO_ABRIR);
    } finally {
      setAbrindo(false);
    }
  };

  // Trocar de documento descarta o erro e o link do anterior.
  const selecionar = (nova: string) => {
    setChave(nova);
    setErro(undefined);
    setLinkAlternativo(undefined);
  };

  return { selecionado, selecionar, abrir, abrindo, erro, linkAlternativo };
}
