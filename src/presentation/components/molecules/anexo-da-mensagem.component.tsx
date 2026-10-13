import { FileText } from "lucide-react";

import { Caixa, Linha } from "@/presentation/components/atoms/caixa.component";
import { ImagemAmpliavel } from "@/presentation/components/atoms/imagem-ampliavel.component";
import { Texto } from "@/presentation/components/atoms/texto.component";

type AnexoDaMensagemProps = {
  tipo: "imagem" | "audio" | "documento";
  nome: string;
  // Já formatado ("1,2 MB").
  tamanho: string;
  url: string;
  // Imagem com miniatura: é ela que aparece no balão; `url` é o original, aberto ao ampliar.
  miniaturaUrl?: string | null;
  // Id do painel da imagem ampliada, único na página.
  painelId: string;
};

// O que o balão mostra de um anexo: imagem em miniatura que amplia; arquivo com ícone, nome,
// tamanho e o link para baixar.
export function AnexoDaMensagem({
  tipo,
  nome,
  tamanho,
  url,
  miniaturaUrl,
  painelId,
}: AnexoDaMensagemProps) {
  if (tipo === "imagem") {
    return (
      <Caixa className="my-1">
        <ImagemAmpliavel
          src={miniaturaUrl ?? url}
          ampliadaSrc={url}
          alt={nome}
          painelId={painelId}
        />
      </Caixa>
    );
  }
  return (
    <Caixa
      como="a"
      href={url}
      download={nome}
      className="my-1 flex min-h-11 items-center gap-2 rounded-lg bg-background/20 px-2 py-1 underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
    >
      <FileText className="size-5 shrink-0" aria-hidden="true" />
      <Linha como="span" className="min-w-0 flex-col">
        <Caixa como="span" className="truncate font-medium" title={nome}>
          {nome}
        </Caixa>
        <Texto como="span" variante="nota" className="text-current opacity-80">
          {tamanho} · Baixar
        </Texto>
      </Linha>
    </Caixa>
  );
}
