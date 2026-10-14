import { LoaderCircle, SendHorizontal, Trash2 } from "lucide-react";

import { Caixa, Linha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { Button } from "@/presentation/components/ui/button";

type BarraDeGravacaoProps = {
  // Já formatado ("01:05").
  tempo: string;
  // Parada: ainda não enviada (limite atingido ou envio que falhou), pronta para enviar ou descartar.
  parada: boolean;
  enviando: boolean;
  onCancelar: () => void;
  onEnviar: () => void;
};

// O campo de resposta enquanto grava: indicador, cronômetro e as duas saídas (descartar ou enviar).
export function BarraDeGravacao({
  tempo,
  parada,
  enviando,
  onCancelar,
  onEnviar,
}: BarraDeGravacaoProps) {
  return (
    <Linha alinhar="centro" espaco={2} className="min-h-12 rounded-2xl border border-border px-2">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Cancelar gravação"
        disabled={enviando}
        onClick={onCancelar}
      >
        <Trash2 aria-hidden="true" />
      </Button>
      <Linha alinhar="centro" espaco={2} className="min-w-0 flex-1">
        <Caixa
          como="span"
          aria-hidden="true"
          className={
            parada
              ? "size-2.5 shrink-0 rounded-full bg-muted-foreground"
              : "size-2.5 shrink-0 rounded-full bg-destructive motion-safe:animate-pulse"
          }
        />
        <Texto como="span" variante="corpo" className="tabular-nums">
          <Caixa como="span" className="sr-only">
            {parada ? "Gravação parada: " : "Gravando: "}
          </Caixa>
          {tempo}
        </Texto>
      </Linha>
      <Button
        type="button"
        size="icon"
        className="rounded-full"
        aria-label="Enviar áudio"
        disabled={enviando}
        onClick={onEnviar}
      >
        {enviando ? (
          <LoaderCircle className="motion-safe:animate-spin" aria-hidden="true" />
        ) : (
          <SendHorizontal aria-hidden="true" />
        )}
      </Button>
    </Linha>
  );
}
