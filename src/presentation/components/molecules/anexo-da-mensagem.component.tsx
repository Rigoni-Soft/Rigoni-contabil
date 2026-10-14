import { Download, Eye, FileText } from "lucide-react";

import { Caixa } from "@/presentation/components/atoms/caixa.component";
import { ImagemAmpliavel } from "@/presentation/components/atoms/imagem-ampliavel.component";
import { PlayerDeAudio } from "@/presentation/components/atoms/player-de-audio.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { abreNoNavegador, type TipoAnexoMensagem } from "@/shared/kernel/anexo";

type AnexoDaMensagemProps = {
  tipo: TipoAnexoMensagem;
  nome: string;
  // Já formatado ("1,2 MB").
  tamanho: string;
  // Baixa o arquivo (para a pasta Downloads); `urlVisualizacao` o abre no navegador.
  url: string;
  urlVisualizacao: string;
  // Imagem com miniatura: é ela que aparece no balão; `url` é o original, aberto ao ampliar.
  miniaturaUrl?: string | null;
  // Id do painel da imagem ampliada, único na página.
  painelId: string;
};

const ACAO =
  "inline-flex min-h-11 items-center gap-1 text-sm underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring";

// O que o balão mostra de um anexo: imagem em miniatura que amplia (e baixa); áudio com player e
// link para baixar; arquivo com ícone, nome, tamanho, "Visualizar" (PDF e texto) e "Baixar".
export function AnexoDaMensagem({
  tipo,
  nome,
  tamanho,
  url,
  urlVisualizacao,
  miniaturaUrl,
  painelId,
}: AnexoDaMensagemProps) {
  if (tipo === "imagem") {
    return (
      <Caixa className="my-1">
        <ImagemAmpliavel
          src={miniaturaUrl ?? url}
          ampliadaSrc={urlVisualizacao}
          baixarHref={url}
          alt={nome}
          painelId={painelId}
        />
      </Caixa>
    );
  }
  if (tipo === "audio") {
    return (
      <Caixa className="my-1">
        <PlayerDeAudio src={url} nome={nome} />
        {/* Plano B: o ogg/opus da mensagem de voz não toca no Safari; o arquivo se baixa. */}
        <Caixa como="a" href={url} download={nome} aria-label={`Baixar ${nome}`} className={ACAO}>
          <Download className="size-4" aria-hidden="true" />
          {tamanho} · Baixar
        </Caixa>
      </Caixa>
    );
  }
  return (
    <Caixa className="my-1 flex flex-col gap-1 rounded-lg bg-background/20 px-2 py-1">
      <Caixa className="flex min-h-11 items-center gap-2">
        <FileText className="size-5 shrink-0" aria-hidden="true" />
        <Caixa como="span" className="flex min-w-0 flex-col">
          <Caixa como="span" className="truncate font-medium" title={nome}>
            {nome}
          </Caixa>
          <Texto como="span" variante="nota" className="text-current opacity-90">
            {tamanho}
          </Texto>
        </Caixa>
      </Caixa>
      <Caixa className="flex flex-wrap gap-3">
        {abreNoNavegador(nome) && (
          <Caixa
            como="a"
            href={urlVisualizacao}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Visualizar ${nome}`}
            className={ACAO}
          >
            <Eye className="size-4" aria-hidden="true" />
            Visualizar
          </Caixa>
        )}
        <Caixa como="a" href={url} download={nome} aria-label={`Baixar ${nome}`} className={ACAO}>
          <Download className="size-4" aria-hidden="true" />
          Baixar
        </Caixa>
      </Caixa>
    </Caixa>
  );
}
