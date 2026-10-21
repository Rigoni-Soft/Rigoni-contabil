import { ExternalLink, FileText } from "lucide-react";

import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { LinkDeAcao } from "@/presentation/components/atoms/link-de-acao.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { Button } from "@/presentation/components/ui/button";

type VisualizarDocumentoContratualProps = {
  // Rótulo do documento mais recente: "Alteração nº N - data", ou "Contrato social" sem alteração.
  rotulo: string;
  onAbrir: () => void;
  abrindo: boolean;
  erro?: string;
  // Link já gerado, oferecido quando o navegador bloqueia a nova aba.
  linkAlternativo?: string;
  // Ação extra ao lado de "Abrir em nova aba" (só o Admin: "Anexar alteração").
  acaoExtra?: React.ReactNode;
};

// Só leitura e sem diálogo: o documento mais recente (a alteração de maior nº) já aparece na tela,
// com o botão que o abre em nova aba no primeiro clique. A tela nunca conhece o caminho do arquivo.
export function VisualizarDocumentoContratual({
  rotulo,
  onAbrir,
  abrindo,
  erro,
  linkAlternativo,
  acaoExtra,
}: VisualizarDocumentoContratualProps) {
  return (
    <Pilha espaco={2} className="rounded-md border border-border p-3">
      <Linha alinhar="fim" justificar="entre" espaco={3} quebra>
        <Linha alinhar="centro" espaco={2} className="min-w-0 flex-1">
          <FileText className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <Pilha espaco={1} className="min-w-0">
            <Texto variante="apoio">Contrato social e alterações</Texto>
            <Texto variante="destaque" como="p" className="break-words">
              {rotulo}
            </Texto>
          </Pilha>
        </Linha>
        <Linha alinhar="centro" espaco={2} quebra>
          <Button
            type="button"
            onClick={onAbrir}
            disabled={abrindo}
            aria-label={abrindo ? undefined : `Abrir ${rotulo} em nova aba`}
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            {abrindo ? "Abrindo…" : "Abrir em nova aba"}
          </Button>
          {acaoExtra}
        </Linha>
      </Linha>
      {erro && <AvisoDeStatus tipo="erro" texto={erro} className="text-sm" />}
      {linkAlternativo && (
        <LinkDeAcao href={linkAlternativo} externo>
          Abrir {rotulo}
        </LinkDeAcao>
      )}
    </Pilha>
  );
}
