import { ExternalLink, FileText, X } from "lucide-react";

import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { Caixa, Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { LinkDeAcao } from "@/presentation/components/atoms/link-de-acao.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { CampoDeOpcoes } from "@/presentation/components/molecules/campo-de-opcoes.component";
import { Button } from "@/presentation/components/ui/button";

// O botão diz o que abre agora; o título diz o que há dentro (o documento em destaque vem abaixo).
const TITULO_DO_DIALOGO = "Contrato social e alterações";

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
  // Link já gerado, oferecido quando o navegador bloqueia a nova aba.
  linkAlternativo?: string;
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
  linkAlternativo,
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
        aria-labelledby={`${painelId}-titulo`}
        className="m-auto w-[min(92vw,28rem)] rounded-xl border border-border bg-background p-4 text-foreground backdrop:bg-overlay"
      >
        <Linha alinhar="centro" justificar="entre" espaco={2}>
          <Texto variante="destaque" como="h2" id={`${painelId}-titulo`}>
            {TITULO_DO_DIALOGO}
          </Texto>
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
        <Button
          type="button"
          onClick={onAbrir}
          disabled={abrindo}
          aria-label={abrindo ? undefined : `Abrir ${selecionado.rotulo} em nova aba`}
          // Foco inicial ao abrir o diálogo (atributo nativo, como no PainelDePrevia).
          ref={(botao) => botao?.setAttribute("autofocus", "")}
        >
          <ExternalLink className="size-4" aria-hidden="true" />
          {abrindo ? "Abrindo…" : "Abrir em nova aba"}
        </Button>
        {erro && <AvisoDeStatus tipo="erro" texto={erro} className="text-sm" />}
        {linkAlternativo && (
          <LinkDeAcao href={linkAlternativo} externo>
            Abrir {selecionado.rotulo}
          </LinkDeAcao>
        )}
        {opcoes.length > 1 && (
          <CampoDeOpcoes
            id={`${painelId}-seletor`}
            rotulo="Escolher documento"
            opcoes={opcoes.map((opcao) => ({ valor: opcao.chave, rotulo: opcao.rotulo }))}
            value={selecionado.chave}
            onChange={(evento) => onSelecionar(evento.target.value)}
          />
        )}
      </Pilha>
    </Caixa>
  );
}
