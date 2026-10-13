import { FileText, X } from "lucide-react";

import { Caixa, Linha } from "@/presentation/components/atoms/caixa.component";
import { Miniatura } from "@/presentation/components/atoms/miniatura.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { Button } from "@/presentation/components/ui/button";

type PreviaDeAnexoProps = {
  nome: string;
  tamanho: string;
  // Só imagem tem miniatura (URL do arquivo local); o resto mostra o ícone.
  miniaturaUrl: string | null;
  onRemover: () => void;
  disabled?: boolean;
};

// O arquivo escolhido, antes de enviar: miniatura (imagem) ou nome e tamanho, com opção de remover.
export function PreviaDeAnexo({
  nome,
  tamanho,
  miniaturaUrl,
  onRemover,
  disabled,
}: PreviaDeAnexoProps) {
  return (
    <Linha alinhar="centro" espaco={3} className="rounded-xl border border-border bg-muted/50 p-2">
      {miniaturaUrl ? (
        <Miniatura src={miniaturaUrl} />
      ) : (
        <FileText className="size-8 shrink-0 text-primary" aria-hidden="true" />
      )}
      <Caixa className="min-w-0 flex-1">
        <Texto variante="corpo" className="truncate">
          {nome}
        </Texto>
        <Texto variante="nota">{tamanho}</Texto>
      </Caixa>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Remover ${nome}`}
        disabled={disabled}
        onClick={onRemover}
      >
        <X aria-hidden="true" />
      </Button>
    </Linha>
  );
}
