import { useCallback, useRef, useState } from "react";

import type { PreviaCarregada } from "@/presentation/lib/previa-de-office";

type Estado = "fechado" | "carregando" | "erro" | "pronto";

// Lê o Word/Excel no navegador na primeira vez que é aberto. As bibliotecas só são baixadas aqui,
// não no carregamento da conversa.
export function usePreviaDeOffice(url: string, formato: "docx" | "xlsx") {
  const [estado, setEstado] = useState<Estado>("fechado");
  const [previa, setPrevia] = useState<PreviaCarregada | undefined>();
  // Dois cliques antes da próxima renderização leriam o mesmo `estado`: o ref fecha essa janela.
  const emAndamento = useRef(false);

  const abrir = useCallback(async () => {
    if (emAndamento.current || previa) return;
    emAndamento.current = true;
    setEstado("carregando");
    try {
      // Sem teto, uma conexão que não responde deixaria o painel em "Carregando" para sempre.
      const resposta = await fetch(url, { signal: AbortSignal.timeout(30_000) });
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
