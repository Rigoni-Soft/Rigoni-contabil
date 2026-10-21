import { ExternalLink, FileText, X } from "lucide-react";

import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { Caixa, Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { CampoDeOpcoes } from "@/presentation/components/molecules/campo-de-opcoes.component";
import { Button } from "@/presentation/components/ui/button";

type OpcaoDocumento = { chave: string; rotulo: string };

type VisualizarDocumentoContratualProps = {
  // Liga o botão ao diálogo; único na página.
  painelId: string;
  rotuloDoBotao: string;
  // Alterações do maior nº para o menor, contrato por último; `selecionado` é o que está em destaque.
  opcoes: OpcaoDocumento[];
  selecionado: OpcaoDocumento;
  onSelecionar: (chave: string) => void;
  onAbrir: () => void;
  abrindo: boolean;
  erro?: string;
};

// Botão + diálogo nativo (popover: fecha com Esc, fora ou pelo botão) só de leitura. O arquivo
// abre no clique, em nova aba; a tela nunca conhece o caminho do arquivo.
export function VisualizarDocumentoContratual({
  painelId,
  rotuloDoBotao,
  opcoes,
  selecionado,
  onSelecionar,
  onAbrir,
  abrindo,
  erro,
}: VisualizarDocumentoContratualProps) {
  return (
    <Caixa>
      <Button type="button" variant="outline" popoverTarget={painelId}>
        <FileText className="size-4" aria-hidden="true" />
        {rotuloDoBotao}
      </Button>
      <Pilha
        espaco={4}
        id={painelId}
        popover="auto"
        role="dialog"
        aria-label={rotuloDoBotao}
        className="m-auto w-[min(92vw,28rem)] rounded-xl border border-border bg-background p-4 text-foreground backdrop:bg-overlay"
      >
        <Linha alinhar="centro" justificar="entre" espaco={2}>
          <Texto variante="destaque">{rotuloDoBotao}</Texto>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            popoverTarget={painelId}
            popoverTargetAction="hide"
            aria-label="Fechar"
            className="shrink-0 rounded-full"
          >
            <X className="size-5" aria-hidden="true" />
          </Button>
        </Linha>
        <Texto variante="subtitulo">{selecionado.rotulo}</Texto>
        <Button type="button" onClick={onAbrir} disabled={abrindo}>
          <ExternalLink className="size-4" aria-hidden="true" />
          {abrindo ? "Abrindo…" : "Abrir"}
        </Button>
        {erro && <AvisoDeStatus tipo="erro" texto={erro} />}
        {opcoes.length > 1 && (
          <CampoDeOpcoes
            id={`${painelId}-seletor`}
            rotulo="Outros documentos"
            opcoes={opcoes.map((opcao) => ({ valor: opcao.chave, rotulo: opcao.rotulo }))}
            value={selecionado.chave}
            onChange={(evento) => onSelecionar(evento.target.value)}
          />
        )}
      </Pilha>
    </Caixa>
  );
}
