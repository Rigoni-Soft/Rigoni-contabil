import { useCallback, useRef, useState } from "react";

import type { PreviaCarregada } from "@/presentation/lib/previa-de-office";
import type { FormatoDeOffice } from "@/shared/kernel/anexo";

const DOWNLOAD_DA_PREVIA_TIMEOUT_MS = 30_000;

type EstadoDaPrevia = "fechado" | "carregando" | "erro" | "pronto";

export function usePreviaDeOffice(url: string, formato: FormatoDeOffice) {
  const [estado, setEstado] = useState<EstadoDaPrevia>("fechado");
  const [previa, setPrevia] = useState<PreviaCarregada | undefined>();
  const emAndamento = useRef(false);

  const abrir = useCallback(async () => {
    if (emAndamento.current || previa) return;
    emAndamento.current = true;
    setEstado("carregando");
    try {
      const resposta = await fetch(url, {
        signal: AbortSignal.timeout(DOWNLOAD_DA_PREVIA_TIMEOUT_MS),
      });
      if (!resposta.ok) throw new Error("download");
      const conteudo = await resposta.arrayBuffer();
      const office = await import("@/presentation/lib/previa-de-office");
      setPrevia(
        formato === "docx"
          ? { tipo: "documento", html: await office.docxParaHtml(conteudo) }
          : { tipo: "planilha", ...(await office.xlsxParaTabela(conteudo)) },
      );
      setEstado("pronto");
    } catch {
      setEstado("erro");
    } finally {
      emAndamento.current = false;
    }
  }, [previa, url, formato]);

  return { estado, previa, abrir };
}
