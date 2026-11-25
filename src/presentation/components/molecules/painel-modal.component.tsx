import type { ReactNode } from "react";
import { X } from "lucide-react";

import { Caixa, Linha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { Button } from "@/presentation/components/ui/button";
import { SUPERFICIE_DE_PAINEL } from "@/presentation/lib/superficie-de-painel";
import { cn } from "@/presentation/lib/utils";

type Props = {
  painelId: string;
  titulo: string;
  rotuloDoFechar: string;
  aoFechar: () => void;
  bloqueado?: boolean;
  children: ReactNode;
};

export function PainelModal({
  painelId,
  titulo,
  rotuloDoFechar,
  aoFechar,
  bloqueado = false,
  children,
}: Props) {
  return (
    <Caixa
      como="dialog"
      id={painelId}
      aria-labelledby={`${painelId}-titulo`}
      closedby={bloqueado ? "none" : "any"}
      onCancel={(e) => {
        if (bloqueado) e.preventDefault();
      }}
      className={cn(
        SUPERFICIE_DE_PAINEL,
        "max-h-[80dvh] w-[min(92vw,32rem)] flex-col overflow-hidden p-0 open:flex",
      )}
    >
      <Linha alinhar="centro" justificar="entre" className="border-b border-border px-4 py-1">
        <Texto variante="subtitulo" como="h2" id={`${painelId}-titulo`}>
          {titulo}
        </Texto>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={aoFechar}
          aria-disabled={bloqueado || undefined}
          aria-label={rotuloDoFechar}
          className="shrink-0 rounded-full"
        >
          <X className="size-5" aria-hidden="true" />
        </Button>
      </Linha>
      {children}
    </Caixa>
  );
}
