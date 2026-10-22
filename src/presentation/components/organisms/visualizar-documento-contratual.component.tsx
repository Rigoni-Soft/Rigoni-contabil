import { ExternalLink, FileText } from "lucide-react";

import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { BotaoAnexarAlteracao } from "@/presentation/components/atoms/botao-anexar-alteracao.component";
import { Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { LinkDeAcao } from "@/presentation/components/atoms/link-de-acao.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { Button } from "@/presentation/components/ui/button";
import { cn } from "@/presentation/lib/utils";

type VisualizarDocumentoContratualProps = {
  // Rótulo do documento em destaque (o mais recente, ou a alteração do aviso): "Alteração nº N - data", ou "Contrato social" sem alteração.
  rotulo: string;
  onAbrir: () => void;
  abrindo: boolean;
  erro?: string;
  // Link já gerado, oferecido quando o navegador bloqueia a nova aba.
  linkAlternativo?: string;
  // Só o Admin: id do diálogo de anexar, aberto pelo botão ao lado de "Abrir em nova aba".
  anexarPainelId?: string;
  // Chegou por um aviso de alteração: o botão de abrir ganha anel de 4 px enquanto estiver em foco. O foco quem dá é o Container, pelo ref.
  destacar?: boolean;
  botaoAbrirRef?: React.Ref<HTMLButtonElement>;
};

// Só leitura e sem diálogo: o documento em destaque (a alteração de maior nº, ou a do aviso por onde
// se chegou) já aparece na tela, com o botão que o abre em nova aba no primeiro clique. A tela nunca conhece o caminho do arquivo.
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
        {/* Base de 12rem (e não 0): sem ela o botão nunca quebra de linha e espreme o rótulo no celular. */}
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
            // aria-disabled (não disabled) para o foco não se perder enquanto abre, como no encerramento.
            onClick={() => !abrindo && onAbrir()}
            aria-disabled={abrindo}
            // O nome começa pelo texto visível (WCAG 2.5.3, comando de voz) e acrescenta qual documento abre.
            aria-label={abrindo ? undefined : `Abrir em nova aba: ${rotulo}`}
            ref={botaoAbrirRef}
            // Anel só enquanto há foco: `focus:` cobre o foco por script depois de um clique de mouse (não casa
            // `:focus-visible`) e `focus-visible:ring-4` troca o `ring-2` padrão do Button.
            className={cn(
              "aria-disabled:pointer-events-none aria-disabled:opacity-50",
              destacar &&
                "focus:ring-4 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background focus-visible:ring-4",
            )}
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            {abrindo ? "Abrindo…" : "Abrir em nova aba"}
          </Button>
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
