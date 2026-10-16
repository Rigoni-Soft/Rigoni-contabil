import { Eye, X } from "lucide-react";

import { Button } from "@/presentation/components/ui/button";
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

// Estilo do documento dentro do iframe: o HTML do arquivo não herda o da página. O Word é "papel":
// fica claro (fundo branco, texto escuro) nos dois temas, como numa folha impressa.
const ESTILO_DO_DOCUMENTO =
  "<style>body{font:15px/1.5 system-ui,sans-serif;margin:16px;color:#1c1917}img{max-width:100%}table{border-collapse:collapse}td,th{border:1px solid #d6d3d1;padding:4px 8px}</style>";

// Botão "Visualizar" que abre o conteúdo de um Word/Excel num popover nativo (fecha com Esc, fora
// ou pelo botão). O arquivo vem do cliente: o HTML do Word fica num iframe sem script nem
// same-origin, e a planilha é só texto em tabela.
export function PainelDePrevia({ nome, painelId, estado, previa, aoAbrir }: PainelDePreviaProps) {
  const vazio =
    previa && (previa.tipo === "documento" ? !previa.html.trim() : !previa.linhas.length);
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
        className="m-auto h-[85dvh] w-[min(92vw,64rem)] flex-col overflow-hidden rounded-xl border border-border bg-background p-0 text-foreground backdrop:bg-overlay [&:popover-open]:flex"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1">
          <p className="truncate text-sm font-medium" title={nome}>
            {nome}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            popoverTarget={painelId}
            popoverTargetAction="hide"
            aria-label="Fechar visualização"
            ref={(botao) => botao?.setAttribute("autofocus", "")}
            className="shrink-0 rounded-full"
          >
            <X className="size-5" aria-hidden="true" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {estado === "carregando" && (
            <p role="status" className="p-4 text-sm">
              Carregando o arquivo…
            </p>
          )}
          {estado === "erro" && (
            <p role="alert" className="p-4 text-sm text-destructive">
              Não foi possível mostrar o arquivo aqui. Feche esta janela e use Baixar para abri-lo
              no seu computador.
            </p>
          )}
          {vazio && (
            <p className="p-4 text-sm text-muted-foreground">Este arquivo não tem conteúdo.</p>
          )}
          {previa?.tipo === "documento" && !vazio && (
            <iframe
              title={`Conteúdo de ${nome}`}
              sandbox=""
              srcDoc={`${ESTILO_DO_DOCUMENTO}${previa.html}`}
              className="size-full border-0 bg-white"
            />
          )}
          {previa?.tipo === "planilha" && !vazio && (
            <div className="p-3">
              <table className="border-collapse text-sm">
                <caption className="mb-2 text-left text-sm font-medium">{previa.nome}</caption>
                <tbody>
                  {previa.linhas.map((linha, i) => (
                    <tr key={i}>
                      {linha.map((celula, j) => (
                        <td
                          key={j}
                          className="max-w-[24rem] border border-border px-2 py-1 align-top break-words"
                        >
                          {celula}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {previa.truncada && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Mostrando as primeiras {previa.linhas.length} linhas. Baixe o arquivo para ver
                  todas.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
