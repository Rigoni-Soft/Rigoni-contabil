import type { ReactNode } from "react";
import { X } from "lucide-react";

import { Caixa, Linha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { Button } from "@/presentation/components/ui/button";
import { SUPERFICIE_DE_PAINEL } from "@/presentation/lib/superficie-de-painel";
import { cn } from "@/presentation/lib/utils";

type Props = {
  // Id do <dialog> (e base do id do título); único na página. O Container o abre com showModal.
  painelId: string;
  titulo: string;
  // Nome acessível do X de fechar.
  rotuloDoFechar: string;
  aoFechar: () => void;
  // O corpo (já com o próprio espaçamento e rolagem) abaixo do cabeçalho.
  children: ReactNode;
};

// A casca dos painéis modais (sino de avisos, leitura de atestado): <dialog> com título, X de fechar e clique
// no véu fechando (nativo: sem suporte, Esc e o X seguem valendo).
export function PainelModal({ painelId, titulo, rotuloDoFechar, aoFechar, children }: Props) {
  return (
    <Caixa
      como="dialog"
      id={painelId}
      aria-labelledby={`${painelId}-titulo`}
      closedby="any"
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
