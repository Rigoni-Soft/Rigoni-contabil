import { ExternalLink, FileText } from "lucide-react";

import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { LinkDeAcao } from "@/presentation/components/atoms/link-de-acao.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { CampoDeOpcoes } from "@/presentation/components/molecules/campo-de-opcoes.component";
import { Button } from "@/presentation/components/ui/button";

type OpcaoDocumento = { valor: string; rotulo: string };

type VisualizarDocumentoContratualProps = {
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

// Só leitura e sem diálogo: o documento em destaque (a alteração de maior nº) já aparece na tela,
// com o botão que o abre em nova aba no primeiro clique. A tela nunca conhece o caminho do arquivo.
export function VisualizarDocumentoContratual({
  opcoes,
  selecionado,
  onSelecionar,
  onAbrir,
  abrindo,
  erro,
  linkAlternativo,
}: VisualizarDocumentoContratualProps) {
  return (
    <Pilha espaco={2} className="rounded-md border border-border p-3">
      <Linha alinhar="fim" justificar="entre" espaco={3} quebra>
        <Linha alinhar="centro" espaco={2} className="min-w-0 flex-1">
          <FileText className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <Pilha espaco={1} className="min-w-0">
            <Texto variante="apoio">Contrato social e alterações</Texto>
            <Texto variante="destaque" como="p" className="break-words">
              {selecionado.rotulo}
            </Texto>
          </Pilha>
        </Linha>
        {opcoes.length > 1 && (
          <CampoDeOpcoes
            id="documento-contratual-seletor"
            rotulo="Escolher documento"
            opcoes={opcoes}
            value={selecionado.valor}
            onChange={(evento) => onSelecionar(evento.target.value)}
            className="w-full sm:w-64"
          />
        )}
        <Button
          type="button"
          variant="outline"
          onClick={onAbrir}
          disabled={abrindo}
          aria-label={abrindo ? undefined : `Abrir ${selecionado.rotulo} em nova aba`}
        >
          <ExternalLink className="size-4" aria-hidden="true" />
          {abrindo ? "Abrindo…" : "Abrir em nova aba"}
        </Button>
      </Linha>
      {erro && <AvisoDeStatus tipo="erro" texto={erro} className="text-sm" />}
      {linkAlternativo && (
        <LinkDeAcao href={linkAlternativo} externo>
          Abrir {selecionado.rotulo}
        </LinkDeAcao>
      )}
    </Pilha>
  );
}
