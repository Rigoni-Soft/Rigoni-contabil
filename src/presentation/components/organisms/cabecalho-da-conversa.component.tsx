"use client";

import { useState } from "react";

type CabecalhoDaConversaProps = {
  titulo: string;
  subtitulo: string;
  encerrado: boolean;
  contexto?: { origem: string; resumo: string } | null;
};

// Resumo acima disso recolhe em 3 linhas; o limite da Transferência é 1000 caracteres.
const RESUMO_LONGO = 160;

export function CabecalhoDaConversa({
  titulo,
  subtitulo,
  encerrado,
  contexto,
}: CabecalhoDaConversaProps) {
  const [aberto, setAberto] = useState(false);
  const longo = (contexto?.resumo.length ?? 0) > RESUMO_LONGO;

  return (
    <header className="shrink-0">
      <h1 className="text-lg font-bold tracking-tight text-primary">{titulo}</h1>
      <p className="text-sm text-muted-foreground">{subtitulo}</p>
      {contexto && (
        <section aria-label="Contexto do Atendimento" className="mt-1 text-sm">
          <p className="font-medium text-muted-foreground">{contexto.origem}</p>
          <p
            id="resumo-do-contexto"
            className={`font-semibold break-words text-foreground ${longo && !aberto ? "line-clamp-3" : ""}`}
          >
            {contexto.resumo}
          </p>
          {longo && (
            <button
              type="button"
              aria-expanded={aberto}
              aria-controls="resumo-do-contexto"
              onClick={() => setAberto(!aberto)}
              className="-ml-2 min-h-11 rounded-md px-2 font-medium text-primary underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {aberto ? "Mostrar menos" : "Ler resumo completo"}
            </button>
          )}
        </section>
      )}
      {encerrado && (
        <p className="mt-1 text-sm font-medium text-muted-foreground">Atendimento encerrado.</p>
      )}
    </header>
  );
}
