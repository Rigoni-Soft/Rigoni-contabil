import { ExternalLink, FileText } from "lucide-react";

import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { BotaoAnexarAlteracao } from "@/presentation/components/atoms/botao-anexar-alteracao.component";
import { Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { LinkDeAcao } from "@/presentation/components/atoms/link-de-acao.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { Button } from "@/presentation/components/ui/button";
import { BOTAO_OCUPADO } from "@/presentation/lib/botao-ocupado";
import { cn } from "@/presentation/lib/utils";

const ID_DESCRICAO_DO_AVISO = "descricao-alteracao-do-aviso";

type VisualizarDocumentoContratualProps = {
  rotulo: string;
  onAbrir: () => void;
  abrindo: boolean;
  erro?: string;
  linkAlternativo?: string;
  anexarPainelId?: string;
  destacar?: boolean;
  botaoAbrirRef?: React.Ref<HTMLButtonElement>;
};

export function VisualizarDocumentoContratual({
  rotulo,
  onAbrir,
  abrindo,
  erro,
  linkAlternativo,
  anexarPainelId,
  destacar,
  botaoAbrirRef,
}: VisualizarDocumentoContratualProps) {
  return (
    <Pilha espaco={2} className="rounded-md border border-border p-3">
      <Linha alinhar="fim" justificar="entre" espaco={3} quebra>
        <Linha alinhar="centro" espaco={2} className="min-w-0 flex-[1_1_12rem]">
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
            onClick={() => !abrindo && onAbrir()}
            aria-disabled={abrindo}
            aria-label={abrindo ? undefined : `Abrir em nova aba: ${rotulo}`}
            ref={botaoAbrirRef}
            aria-describedby={destacar ? ID_DESCRICAO_DO_AVISO : undefined}
            className={cn(
              BOTAO_OCUPADO,
              destacar &&
                "focus:ring-4 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background focus-visible:ring-4",
            )}
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            {abrindo ? "Abrindo…" : "Abrir em nova aba"}
          </Button>
          {destacar && (
            <Texto variante="somenteLeitor" como="span" id={ID_DESCRICAO_DO_AVISO}>
              Esta é a alteração do aviso que você abriu.
            </Texto>
          )}
          {anexarPainelId && <BotaoAnexarAlteracao painelId={anexarPainelId} />}
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
