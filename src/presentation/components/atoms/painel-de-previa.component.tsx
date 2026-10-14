import { Eye, X } from "lucide-react";

import type { PreviaCarregada } from "@/presentation/lib/previa-de-office";

type PainelDePreviaProps = {
  nome: string;
  // Liga o botão ao painel; único na página.
  painelId: string;
  estado: "fechado" | "carregando" | "erro" | "pronto";
  previa?: PreviaCarregada;
  // Chamado ao abrir: o Container carrega o arquivo.
  aoAbrir: () => void;
};

// Estilo do documento dentro do iframe: o HTML do arquivo não herda o da página.
const ESTILO_DO_DOCUMENTO =
  "<style>body{font:15px/1.5 system-ui,sans-serif;margin:16px;color:#1c1917}img{max-width:100%}table{border-collapse:collapse}td,th{border:1px solid #d6d3d1;padding:4px 8px}</style>";

// Botão "Visualizar" que abre o conteúdo de um Word/Excel num popover nativo (fecha com Esc, fora
// ou pelo botão). O arquivo vem do cliente: o HTML do Word fica num iframe sem script nem
// same-origin, e a planilha é só texto em tabela.
export function PainelDePrevia({ nome, painelId, estado, previa, aoAbrir }: PainelDePreviaProps) {
  return (
    <>
      <button
        type="button"
        popoverTarget={painelId}
        onClick={aoAbrir}
        aria-label={`Visualizar ${nome}`}
        className="inline-flex min-h-11 items-center gap-1 text-sm underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Eye className="size-4" aria-hidden="true" />
        Visualizar
      </button>
      <div
        id={painelId}
        popover="auto"
        role="dialog"
        aria-label={`Visualização de ${nome}`}
        className="m-auto h-[85dvh] w-[min(92vw,64rem)] flex-col overflow-hidden rounded-xl border border-border bg-background p-0 text-foreground backdrop:bg-black/60 [&:popover-open]:flex"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1">
          <p className="truncate text-sm font-medium" title={nome}>
            {nome}
          </p>
          <button
            type="button"
            popoverTarget={painelId}
            popoverTargetAction="hide"
            aria-label="Fechar visualização"
            ref={(botao) => botao?.setAttribute("autofocus", "")}
            className="flex size-11 shrink-0 items-center justify-center rounded-full outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {estado === "carregando" && <p className="p-4 text-sm">Carregando o arquivo…</p>}
          {estado === "erro" && (
            <p role="alert" className="p-4 text-sm text-destructive">
              Não foi possível abrir este arquivo. Baixe-o para ver o conteúdo.
            </p>
          )}
          {estado === "pronto" && previa?.tipo === "documento" && (
            <iframe
              title={`Conteúdo de ${nome}`}
              sandbox=""
              srcDoc={`${ESTILO_DO_DOCUMENTO}${previa.html}`}
              className="size-full border-0 bg-white"
            />
          )}
          {estado === "pronto" && previa?.tipo === "planilha" && (
            <div className="p-3">
              <p className="mb-2 text-sm font-medium">{previa.nome}</p>
              <table className="border-collapse text-sm">
                <tbody>
                  {previa.linhas.map((linha, i) => (
                    <tr key={i}>
                      {linha.map((celula, j) => (
                        <td key={j} className="border border-border px-2 py-1 align-top">
                          {celula}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {previa.truncada && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Mostrando só as primeiras linhas. Baixe o arquivo para ver tudo.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
